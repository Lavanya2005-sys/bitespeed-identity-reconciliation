import db from "./database";
import { Contact, IdentifyResponse } from "./types";

/**
 * Find all contacts matching an email or phone number.
 */
function findContactsByEmailOrPhone(
    email: string | null,
    phoneNumber: string | null
): Contact[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (email) {
        conditions.push("email = ?");
        params.push(email);
    }
    if (phoneNumber) {
        conditions.push("phoneNumber = ?");
        params.push(phoneNumber);
    }

    if (conditions.length === 0) return [];

    const query = `SELECT * FROM Contact WHERE (${conditions.join(
        " OR "
    )}) AND deletedAt IS NULL ORDER BY createdAt ASC`;
    return db.prepare(query).all(...params) as Contact[];
}

/**
 * Find a contact by its ID.
 */
function findContactById(id: number): Contact | undefined {
    return db
        .prepare("SELECT * FROM Contact WHERE id = ? AND deletedAt IS NULL")
        .get(id) as Contact | undefined;
}

/**
 * Find all secondary contacts linked to a primary contact.
 */
function findSecondaryContacts(primaryId: number): Contact[] {
    return db
        .prepare(
            "SELECT * FROM Contact WHERE linkedId = ? AND deletedAt IS NULL ORDER BY createdAt ASC"
        )
        .all(primaryId) as Contact[];
}

/**
 * Create a new contact row.
 */
function createContact(
    email: string | null,
    phoneNumber: string | null,
    linkedId: number | null,
    linkPrecedence: "primary" | "secondary"
): Contact {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
    INSERT INTO Contact (phoneNumber, email, linkedId, linkPrecedence, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
    const result = stmt.run(
        phoneNumber || null,
        email || null,
        linkedId,
        linkPrecedence,
        now,
        now
    );
    return findContactById(result.lastInsertRowid as number)!;
}

/**
 * Update a contact to become secondary.
 */
function turnContactIntoSecondary(
    contactId: number,
    newPrimaryId: number
): void {
    const now = new Date().toISOString();
    db.prepare(
        `UPDATE Contact SET linkedId = ?, linkPrecedence = 'secondary', updatedAt = ? WHERE id = ?`
    ).run(newPrimaryId, now, contactId);
}

/**
 * Re-link all secondaries of a former primary to a new primary.
 */
function relinkSecondaries(
    oldPrimaryId: number,
    newPrimaryId: number
): void {
    const now = new Date().toISOString();
    db.prepare(
        `UPDATE Contact SET linkedId = ?, updatedAt = ? WHERE linkedId = ? AND deletedAt IS NULL`
    ).run(newPrimaryId, now, oldPrimaryId);
}

/**
 * Get the root primary contact for any given contact.
 */
function getPrimaryContact(contact: Contact): Contact {
    let current = contact;
    while (current.linkPrecedence === "secondary" && current.linkedId !== null) {
        const parent = findContactById(current.linkedId);
        if (!parent) break;
        current = parent;
    }
    return current;
}

/**
 * Build the consolidated response for a primary contact.
 */
function buildResponse(primaryContact: Contact): IdentifyResponse {
    const secondaries = findSecondaryContacts(primaryContact.id);

    const emails: string[] = [];
    const phoneNumbers: string[] = [];
    const secondaryContactIds: number[] = [];

    // Primary contact's info comes first
    if (primaryContact.email) emails.push(primaryContact.email);
    if (primaryContact.phoneNumber)
        phoneNumbers.push(primaryContact.phoneNumber);

    for (const sec of secondaries) {
        secondaryContactIds.push(sec.id);
        if (sec.email && !emails.includes(sec.email)) {
            emails.push(sec.email);
        }
        if (sec.phoneNumber && !phoneNumbers.includes(sec.phoneNumber)) {
            phoneNumbers.push(sec.phoneNumber);
        }
    }

    return {
        contact: {
            primaryContatctId: primaryContact.id,
            emails,
            phoneNumbers,
            secondaryContactIds,
        },
    };
}

/**
 * Main identify logic.
 * Handles all scenarios:
 * 1. No existing contacts → create new primary
 * 2. Existing contacts found → link and consolidate
 * 3. Two separate primary groups linked → merge (older becomes primary)
 */
export function identify(
    email: string | null,
    phoneNumber: string | null
): IdentifyResponse {
    // Normalize phoneNumber to string
    const normalizedPhone = phoneNumber ? String(phoneNumber) : null;
    const normalizedEmail = email || null;

    // If both are null/empty, return error (shouldn't happen per spec but be safe)
    if (!normalizedEmail && !normalizedPhone) {
        throw new Error("At least one of email or phoneNumber must be provided");
    }

    // Find all existing contacts that match email OR phone
    const matchingContacts = findContactsByEmailOrPhone(
        normalizedEmail,
        normalizedPhone
    );

    // CASE 1: No matching contacts → create a new primary
    if (matchingContacts.length === 0) {
        const newContact = createContact(
            normalizedEmail,
            normalizedPhone,
            null,
            "primary"
        );
        return buildResponse(newContact);
    }

    // Find all distinct primary contacts
    const primaryContactsMap = new Map<number, Contact>();
    for (const contact of matchingContacts) {
        const primary = getPrimaryContact(contact);
        primaryContactsMap.set(primary.id, primary);
    }

    const primaryContacts = Array.from(primaryContactsMap.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // The oldest primary is THE primary
    const truePrimary = primaryContacts[0];

    // CASE 3: Multiple primary groups → merge them
    // Turn younger primaries into secondaries of the oldest primary
    if (primaryContacts.length > 1) {
        for (let i = 1; i < primaryContacts.length; i++) {
            const youngerPrimary = primaryContacts[i];
            // Re-link all secondaries of the younger primary to the true primary
            relinkSecondaries(youngerPrimary.id, truePrimary.id);
            // Turn the younger primary itself into a secondary
            turnContactIntoSecondary(youngerPrimary.id, truePrimary.id);
        }
    }

    // CASE 2: Check if this request introduces new information
    // Gather all contacts in the group (primary + all secondaries)
    const allGroupContacts = [truePrimary, ...findSecondaryContacts(truePrimary.id)];

    const existingEmails = new Set(
        allGroupContacts.map((c) => c.email).filter(Boolean)
    );
    const existingPhones = new Set(
        allGroupContacts.map((c) => c.phoneNumber).filter(Boolean)
    );

    const hasNewEmail = normalizedEmail && !existingEmails.has(normalizedEmail);
    const hasNewPhone =
        normalizedPhone && !existingPhones.has(normalizedPhone);

    // Check if an exact duplicate already exists (same email AND phone)
    const exactMatch = allGroupContacts.some(
        (c) =>
            c.email === normalizedEmail && c.phoneNumber === normalizedPhone
    );

    if (!exactMatch && (hasNewEmail || hasNewPhone)) {
        // Create a new secondary contact with the new info
        createContact(normalizedEmail, normalizedPhone, truePrimary.id, "secondary");
    }

    return buildResponse(truePrimary);
}
