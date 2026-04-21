<?php

namespace App\Services;

use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class WalletService
{
    /**
     * Add funds to a user's wallet. Atomic.
     * Used by successful Stripe top-ups or admin credits.
     */
    public function credit(
        User $user,
        float $amount,
        string $type = WalletTransaction::TYPE_TOP_UP,
        ?string $description = null,
        ?string $stripePaymentIntentId = null,
    ): WalletTransaction {
        if ($amount <= 0) {
            throw new RuntimeException('Credit amount must be positive.');
        }

        return DB::transaction(function () use ($user, $amount, $type, $description, $stripePaymentIntentId) {
            // Lock the user row to prevent race conditions
            $fresh = User::withoutGlobalScopes()->lockForUpdate()->find($user->id);
            $newBalance = (float) $fresh->balance + $amount;

            $fresh->update(['balance' => $newBalance]);

            return WalletTransaction::create([
                'user_id'                  => $fresh->id,
                'tenant_id'                => $fresh->tenant_id,
                'type'                     => $type,
                'amount'                   => $amount,
                'balance_after'            => $newBalance,
                'description'              => $description,
                'stripe_payment_intent_id' => $stripePaymentIntentId,
                'status'                   => WalletTransaction::STATUS_SUCCEEDED,
            ]);
        });
    }

    /**
     * Deduct funds from a user's wallet. Atomic.
     * Returns null and does nothing if insufficient balance.
     */
    public function debit(
        User $user,
        float $amount,
        string $description,
    ): ?WalletTransaction {
        if ($amount <= 0) {
            throw new RuntimeException('Debit amount must be positive.');
        }

        return DB::transaction(function () use ($user, $amount, $description) {
            $fresh = User::withoutGlobalScopes()->lockForUpdate()->find($user->id);

            if ((float) $fresh->balance < $amount) {
                return null;
            }

            $newBalance = (float) $fresh->balance - $amount;
            $fresh->update(['balance' => $newBalance]);

            return WalletTransaction::create([
                'user_id'       => $fresh->id,
                'tenant_id'     => $fresh->tenant_id,
                'type'          => WalletTransaction::TYPE_CHARGE,
                'amount'        => -$amount,
                'balance_after' => $newBalance,
                'description'   => $description,
                'status'        => WalletTransaction::STATUS_SUCCEEDED,
            ]);
        });
    }
}
