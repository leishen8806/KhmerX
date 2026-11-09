ALTER TABLE loan_index ADD COLUMN public_ref TEXT;
--> statement-breakpoint
UPDATE loan_index
SET public_ref=(
  SELECT json_extract(loan.value,'$.publicRef')
  FROM customer_workspaces c, json_each(c.payload,'$.loans') loan
  WHERE c.owner=loan_index.owner
    AND json_extract(loan.value,'$.id')=loan_index.loan_id
  LIMIT 1
)
WHERE public_ref IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX loan_index_public_ref_unique
  ON loan_index(owner, public_ref) WHERE public_ref IS NOT NULL;
