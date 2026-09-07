-- Keep other shops and their historical orders intact, but stop offering them
-- for new collections. They can be re-enabled from admin when ready.
UPDATE "Location" SET "active" = false
WHERE "slug" IN ('henley-in-arden', 'stratford-upon-avon');
