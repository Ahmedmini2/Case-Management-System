export default function EmailSettingsPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">Email Settings</h2>
      <p className="text-sm text-muted-foreground">
        Configure sender identity and inbound webhook settings via environment variables.
      </p>
      <ul className="list-disc pl-5 text-sm text-muted-foreground">
        <li>`RESEND_API_KEY`</li>
        <li>`EMAIL_FROM` / `EMAIL_FROM_NAME`</li>
        <li>`WEBHOOK_SECRET`</li>
      </ul>
    </div>
  );
}
