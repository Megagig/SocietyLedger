-- Optional member profile photo: storage keys only, the file itself lives in private storage.
ALTER TABLE "members" ADD COLUMN "photo_key" TEXT, ADD COLUMN "photo_thumb_key" TEXT, ADD COLUMN "photo_updated_at" TIMESTAMP(3);
