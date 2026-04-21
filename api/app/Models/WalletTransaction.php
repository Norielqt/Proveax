<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WalletTransaction extends Model
{
    public const TYPE_TOP_UP = 'top_up';
    public const TYPE_CHARGE = 'charge';
    public const TYPE_REFUND = 'refund';

    public const STATUS_PENDING   = 'pending';
    public const STATUS_SUCCEEDED = 'succeeded';
    public const STATUS_FAILED    = 'failed';

    protected $fillable = [
        'user_id', 'tenant_id', 'type', 'amount', 'balance_after',
        'description', 'stripe_payment_intent_id', 'status',
    ];

    protected $casts = [
        'amount'        => 'decimal:2',
        'balance_after' => 'decimal:2',
    ];

    public function user()   { return $this->belongsTo(User::class); }
    public function tenant() { return $this->belongsTo(Tenant::class); }
}
