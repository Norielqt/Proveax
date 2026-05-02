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
            ->line("To get started, pick a plan and add a card — you'll get a 7-day free trial and won't be charged until it ends. Cancel anytime.")
            ->action('Pick Your Plan', rtrim($frontendUrl, '/') . '/onboarding/plan')
            ->line('If you have any questions, just reply to this email — we\'re happy to help.')
            ->salutation("The {$appName} Team");
    }
}
