# Shared MinIO (file storage) on Dokploy

One MinIO serves all your apps. Each app gets **its own bucket** and **its own key that can only touch that bucket**.
The commands below were run against a real MinIO to check them: a scoped key can upload, create signed links and
delete in its own bucket, and is refused (`AccessDenied`) on any other bucket.

SocietyLedger uses MinIO for payment proofs, expense receipts, cash deposit slips and support attachments.

## 1. Deploy the MinIO stack (once)

1. Dokploy > Create service > **Docker Compose**. Point it at `docker-compose.minio.yml` in this repo (or paste it).
2. Environment tab, values you make up:

   | Variable | Value |
   |---|---|
   | `MINIO_ROOT_USER` | an admin username, 3+ characters |
   | `MINIO_ROOT_PASSWORD` | `openssl rand -hex 24` (or any 8+ character password). This is the **admin** login. Keep it, never give it to an app. |
   | `FILES_DOMAIN` | `files.societyledger.com.ng` |

   Set both before the first start: MinIO reads them only when it creates its data. The deploy refuses to start if
   either is missing.
3. Domains tab: `files.societyledger.com.ng` -> service **minio**, port **9000**, HTTPS on.
   Create the DNS record for it first. Do **not** publish port 9001 (the admin console).
4. Deploy. The container is named `shared-minio` and joins `dokploy-network`, so other stacks reach it at
   `http://shared-minio:9000`.

## 2. Give an app its own bucket and key (once per app)

Run these in the MinIO container (Dokploy > the stack > Terminal, service `minio`), or anywhere with the `mc` tool.
Change `APP` for each app. The secret is generated for you:

```sh
APP=societyledger
# 32 random characters. MinIO allows 8 to 40, so do NOT use "openssl rand -hex 24" (48 characters).
# Keep the $( ) around the command: it runs the command and stores its output. Do not paste a value inside it.
APP_SECRET=$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')
echo "$APP_SECRET"                         # copy it now, you need it in step 3
mc alias set local http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc mb --ignore-existing local/$APP
cat > /tmp/$APP-policy.json <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": ["arn:aws:s3:::$APP"] },
    { "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": ["arn:aws:s3:::$APP/*"] }
  ]
}
JSON
mc admin policy create local $APP-rw /tmp/$APP-policy.json
mc admin user add local $APP-app "$APP_SECRET"
mc admin policy attach local $APP-rw --user $APP-app
echo "Access key: $APP-app"; echo "Secret key: $APP_SECRET"
```

The bucket must be created here, by an admin: the app's key can use a bucket but cannot create one.

## 3. Point the app at it

SocietyLedger's Dokploy environment:

| Variable | Value |
|---|---|
| `MINIO_ENDPOINT` | `http://shared-minio:9000` |
| `MINIO_PUBLIC_ENDPOINT` | `https://files.societyledger.com.ng` |
| `MINIO_ACCESS_KEY` | `societyledger-app` (the user created above) |
| `MINIO_SECRET_KEY` | the `APP_SECRET` from step 2 |
| `MINIO_BUCKET` | `societyledger` |

Why two addresses: the API uploads over the internal network (`MINIO_ENDPOINT`). Receipts are opened by phones and
browsers through signed links, which must use the public HTTPS address (`MINIO_PUBLIC_ENDPOINT`).
If the API container cannot reach `shared-minio`, use the public address for both.

A second app repeats step 2 with its own `APP`, and uses the same two addresses.

## 4. Check it works

After deploying SocietyLedger, upload a payment proof in the app and open it. In the API log you should not see
`[storage] MinIO bucket init failed`. If receipts upload but will not open, `MINIO_PUBLIC_ENDPOINT` is missing or wrong.

## 5. Back it up

Payment receipts are records. Pick one:
- Dokploy volume backups for the `minio_data` volume, or
- a scheduled `mc mirror local/societyledger <other-location>` (another disk, another server, or cloud storage).

## Troubleshooting
- `The secret key is invalid (length should be between 8 and 40)`: the secret is empty or too long. `echo "$APP_SECRET"` should print 32 characters.
- `command not found` right after `APP_SECRET=$(...)`: a value was pasted inside `$( )`. Keep the command there, or write `APP_SECRET=thevalue` with no `$( )`.
- `Specified user does not exist` when attaching the policy: the `user add` line failed. Fix the secret and run those two lines again; the bucket and policy are already created.

## Rotating a key
`mc admin user add local $APP-app "<new secret>"` replaces the secret; update `MINIO_SECRET_KEY` in the app and redeploy.
If a secret has been shared anywhere (chat, screenshots, a commit), rotate it.
