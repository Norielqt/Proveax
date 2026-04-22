<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\GoogleAuthController;
use App\Http\Controllers\Api\TenantController;
use App\Http\Controllers\Api\InviteController;
use App\Http\Controllers\Api\PropertyController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\SkipTraceController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\RentcastController;
use App\Http\Controllers\Api\WalletController;
use App\Http\Controllers\Api\MemberController;
use App\Http\Controllers\Api\TeamSettingsController;
use App\Http\Controllers\Api\WorkSessionController;
use App\Http\Controllers\Api\ScreenshotController;
use App\Http\Controllers\Api\TimesheetController;
use App\Http\Controllers\Api\ApiUsageController;
use App\Http\Controllers\Api\TeamOverviewController;
use App\Http\Controllers\Api\LeadController;
use Illuminate\Support\Facades\Route;

// Google OAuth – complete onboarding (no auth required yet)
Route::post('/auth/google/complete', [GoogleAuthController::class, 'complete']);

// ---------- Public ----------
Route::post('/register',       [AuthController::class, 'registerAdmin']);
Route::post('/login',          [AuthController::class, 'login']);
Route::post('/invites/accept', [InviteController::class, 'accept']);
// Signed URL — authorization handled inside controller via signature + viewer id
Route::get('/screenshots/{id}/image', [ScreenshotController::class, 'show'])
    ->name('screenshots.show');

// ---------- Authenticated ----------
Route::middleware('auth:sanctum')->group(function () {

    Route::get ('/me',     [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/me/consent', [AuthController::class, 'consent']);

    // CRM leads — shared workspace spreadsheet; any team member can read/write
    Route::get   ('/leads',        [LeadController::class, 'index']);
    Route::post  ('/leads',        [LeadController::class, 'store']);
    Route::patch ('/leads/{id}',   [LeadController::class, 'update']);
    Route::delete('/leads/{id}',   [LeadController::class, 'destroy']);

    // Work sessions — every authed user may manage their own session
    Route::get ('/work-sessions/current',        [WorkSessionController::class, 'current']);
    Route::get ('/work-sessions/today-summary',  [WorkSessionController::class, 'todaySummary']);
    Route::get ('/work-sessions',                [WorkSessionController::class, 'index']);
    Route::post('/work-sessions',                [WorkSessionController::class, 'start']);
    Route::post('/work-sessions/{id}/heartbeat', [WorkSessionController::class, 'heartbeat']);
    Route::post('/work-sessions/{id}/end',       [WorkSessionController::class, 'end']);

    // Screenshots
    Route::post  ('/screenshots',              [ScreenshotController::class, 'store']);
    Route::get   ('/screenshots',              [ScreenshotController::class, 'index']);
    Route::delete('/screenshots/{id}',         [ScreenshotController::class, 'destroy']);
    // Team settings: readable by all members (for consent modal), admin-only write
    Route::get ('/team/settings', [TeamSettingsController::class, 'show']);

    // Timesheets — index/generate/submit are accessible to owners; admin reviews
    Route::get ('/timesheets',                [TimesheetController::class, 'index']);
    Route::post('/timesheets/generate',       [TimesheetController::class, 'generate']);
    Route::post('/timesheets/{id}/submit',    [TimesheetController::class, 'submit']);

    // Billing always accessible
    Route::get ('/billing/status',                [SubscriptionController::class, 'status']);
    Route::post('/billing/checkout',              [SubscriptionController::class, 'createCheckout']);
    Route::post('/billing/subscription/intent',   [SubscriptionController::class, 'createSubscriptionIntent']);
    Route::post('/billing/subscription/confirm',  [SubscriptionController::class, 'confirmSubscription']);
    Route::post('/billing/subscription/cancel',   [SubscriptionController::class, 'cancel']);

    // Wallet
    Route::get ('/wallet/summary',             [WalletController::class, 'summary']);
    Route::get ('/wallet/transactions',        [WalletController::class, 'transactions']);
    Route::post('/wallet/top-up/intent',       [WalletController::class, 'createTopUpIntent']);
    Route::post('/wallet/top-up/confirm',      [WalletController::class, 'confirmTopUp']);

    // Feature-gated: trial OR paid
    Route::middleware('feature.access')->group(function () {
        Route::get('/properties/search', [PropertyController::class, 'search'])->name('properties.search');
        Route::get('/properties/{id}',   [PropertyController::class, 'show'])->name('properties.show');

        // ATTOM national database proxy
        Route::get('/rentcast/search',     [RentcastController::class, 'search']);
        Route::get('/rentcast/avm',        [RentcastController::class, 'avm']);
        Route::get('/rentcast/fulldetail', [RentcastController::class, 'fullDetail']);
    });

    // Paid-only
    Route::middleware('feature.access:paid')->group(function () {
        Route::post('/properties/{id}/skip-trace', [SkipTraceController::class, 'run']);
    });

    // Admin only
    Route::middleware('role:admin')->group(function () {
        Route::patch('/tenant',           [TenantController::class, 'update']);
        Route::get  ('/employees',        [TenantController::class, 'employees']);
        Route::post ('/invites',              [InviteController::class, 'create']);
        Route::get  ('/invites',              [InviteController::class, 'index']);
        Route::post ('/invites/{id}/resend',  [InviteController::class, 'resend']);
        Route::post ('/invites/{id}/revoke',  [InviteController::class, 'revoke']);
        Route::get  ('/activity-logs',    [ActivityLogController::class, 'index']);

        // Team management
        Route::get   ('/team/members',                [MemberController::class, 'index']);
        Route::patch ('/team/members/{id}/role',      [MemberController::class, 'updateRole']);
        Route::post  ('/team/members/{id}/pause',     [MemberController::class, 'pause']);

        // Overview + API usage dashboards
        Route::get('/admin/team/overview', [TeamOverviewController::class, 'index']);
        Route::get('/admin/api-usage',     [ApiUsageController::class, 'index']);

        // Timesheet reviews + CSV export (admin-only)
        Route::get ('/timesheets/export',        [TimesheetController::class, 'export']);
        Route::post('/timesheets/{id}/approve',  [TimesheetController::class, 'approve']);
        Route::post('/timesheets/{id}/reject',   [TimesheetController::class, 'reject']);
        Route::post  ('/team/members/{id}/unpause',   [MemberController::class, 'unpause']);
        Route::delete('/team/members/{id}',           [MemberController::class, 'destroy']);

        Route::patch('/team/settings',  [TeamSettingsController::class, 'update']);
        Route::get  ('/activity/summary', [ActivityLogController::class, 'summary']);
    });
});
