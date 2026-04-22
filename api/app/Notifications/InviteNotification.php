<?php
namespace App\Notifications;

use App\Models\Invite;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class InviteNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Invite $invite,
        public ?User $inviter,
        public string $acceptUrl,
    ) {}

    public function via($notifiable): array
    {
        return ['mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $inviterName = $this->inviter?->name ?: 'Your team';
        $tenantName  = $this->invite->tenant?->name ?: 'the team';
        $appName     = config('app.name', 'Proviaxx');

        return (new MailMessage)
            ->subject("You've been invited to join {$tenantName} on {$appName}")
            ->greeting('Hello!')
            ->line("{$inviterName} has invited you to join {$tenantName} on {$appName}.")
            ->action('Accept Invitation', $this->acceptUrl)
            ->line('This invitation expires on ' . $this->invite->expires_at->format('F j, Y g:i A') . '.')
            ->line('If you did not expect this invitation, you can safely ignore this email.');
    }
}
