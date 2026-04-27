<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class WelcomeNotification extends Notification
{
    use Queueable;

    public function __construct(public User $user) {}

    public function via($notifiable): array
    {
        return ['mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $appName    = config('app.name', 'Proveax');
        $frontendUrl = config('app.frontend_url', config('app.url'));

        return (new MailMessage)
            ->subject("Welcome to {$appName}!")
            ->greeting("Hi {$this->user->name}!")
            ->line("Thanks for signing up. Your account for **{$this->user->tenant->name}** is ready.")
            ->line("You're now on a free trial — explore all features and see what {$appName} can do for your team.")
            ->action('Get Started', $frontendUrl)
            ->line('If you have any questions, just reply to this email — we\'re happy to help.')
            ->salutation("The {$appName} Team");
    }
}
