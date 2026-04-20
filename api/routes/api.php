<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\TenantController;
use App\Http\Controllers\Api\InviteController;
use App\Http\Controllers\Api\PropertyController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\SkipTraceController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AttomController;
use Illuminate\Support\Facades\Route;

// ---------- Public ----------
Route::post('/register',       [AuthController::class, 'registerAdmin']);
Route::post('/login',          [AuthController::class, 'login']);
Route::post('/invites/accept', [InviteController::class, 'accept']);

// ---------- Authenticated ----------
Route::middleware('auth:sanctum')->group(function () {

    Route::get ('/me',     [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Billing always accessible
    Route::get ('/billing/status',   [SubscriptionController::class, 'status']);
    Route::post('/billing/checkout', [SubscriptionController::class, 'createCheckout']);

    // Feature-gated: trial OR paid
    Route::middleware('feature.access')->group(function () {
        Route::get('/properties/search', [PropertyController::class, 'search'])->name('properties.search');
        Route::get('/properties/{id}',   [PropertyController::class, 'show'])->name('properties.show');

        // ATTOM national database proxy
        Route::get('/attom/search',     [AttomController::class, 'search']);
        Route::get('/attom/detail',     [AttomController::class, 'detail']);
        Route::get('/attom/avm',        [AttomController::class, 'avm']);
        Route::get('/attom/fulldetail', [AttomController::class, 'fullDetail']);
    });

    // Paid-only
    Route::middleware('feature.access:paid')->group(function () {
        Route::post('/properties/{id}/skip-trace', [SkipTraceController::class, 'run']);
    });

    // Admin only
    Route::middleware('role:admin')->group(function () {
        Route::patch('/tenant',           [TenantController::class, 'update']);
        Route::get  ('/employees',        [TenantController::class, 'employees']);
        Route::post ('/invites',          [InviteController::class, 'create']);
        Route::get  ('/invites',          [InviteController::class, 'index']);
        Route::get  ('/activity-logs',    [ActivityLogController::class, 'index']);
        Route::get  ('/activity/summary', [ActivityLogController::class, 'summary']);
    });
});
