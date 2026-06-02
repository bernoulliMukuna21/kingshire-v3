# Email Notifications

KingsHire uses Brevo for transactional email. In-app notifications are always
created in Supabase; email delivery is optional and only runs when Brevo is
fully configured.

Required variables for email delivery:

- `BREVO_API_KEY`
- `BREVO_SENDER_NAME`
- `BREVO_SENDER_EMAIL`

Optional:

- `ADMIN_NOTIFICATION_EMAIL`

## Sender Address

The Brevo account login email does not need to match the sender address. You can
use the KingsHire Gmail address as the sender if it is verified as a sender in
Brevo.

Recommended MVP values:

```text
BREVO_SENDER_NAME=KingsHire
BREVO_SENDER_EMAIL=kingshirecompany@gmail.com
ADMIN_NOTIFICATION_EMAIL=kingshirecompany@gmail.com
```

Before production, verify the sender/domain in Brevo. If the sender is not
verified, Brevo may reject or throttle email delivery.

For stronger deliverability later, use a domain mailbox such as
`notifications@kingshire.co.uk` and configure the DNS records Brevo provides.
