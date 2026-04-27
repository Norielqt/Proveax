<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Mail\MailManager;
use Symfony\Component\Mailer\Bridge\Brevo\Transport\BrevoTransportFactory;
use Symfony\Component\Mailer\Transport\Dsn;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        $this->app->make(MailManager::class)->extend('brevo', function (array $config) {
            $factory = new BrevoTransportFactory();
            return $factory->create(new Dsn(
                'brevo+api',
                'default',
                $config['key'] ?? config('mail.mailers.brevo.key'),
            ));
        });
    }
}
