<?php

use App\Http\Controllers\Api\GoogleAuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Google OAuth – must run on web (session) middleware
Route::prefix('auth/google')->group(function () {
    Route::get('redirect-url', [GoogleAuthController::class, 'redirectUrl']);
    Route::get('callback',     [GoogleAuthController::class, 'callback']);
});
