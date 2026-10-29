-- Neither shop has a phone line (owner, 29 Oct 2026). The old Bentley Heath number was
-- being published to Google and AI crawlers from this row. Clears only that exact number,
-- in any of the formats it was entered as, so a real number added later is untouched.
UPDATE "Location"
SET "phone" = NULL
WHERE regexp_replace(COALESCE("phone", ''), '[^0-9]', '', 'g') IN ('01564703441', '441564703441');
