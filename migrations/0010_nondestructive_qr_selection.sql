ALTER TABLE business_payment_qrs
ADD COLUMN source_image TEXT NOT NULL DEFAULT '';

ALTER TABLE business_payment_qrs
ADD COLUMN crop_selection TEXT NOT NULL DEFAULT '{"x":0,"y":0,"w":1,"h":1}';

UPDATE business_payment_qrs
SET source_image = image
WHERE source_image = '';
