<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class LeadController extends Controller
{
    private const LEAD_TYPES = ['cold', 'warm', 'hot', 'qualified', 'closed'];

    private const SOURCE_TYPES = [
        'absentee_owner', 'out_of_state_owner', 'high_equity', 'cash_buyers', 'vacant_lots',
        'mls_active', 'mls_pending', 'mls_withdrawn', 'mls_sold',
    ];

    /** GET /api/leads */
    public function index(Request $request)
    {
        return Lead::with(['updatedBy:id,name'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($l) => $this->toRow($l));
    }

    /** POST /api/leads — creates an empty row (spreadsheet-style) */
    public function store(Request $request)
    {
        $data = $this->validated($request, creating: true);

        $lead = Lead::create(array_merge($data, [
            'tenant_id'          => $request->user()->tenant_id,
            'created_by_user_id' => $request->user()->id,
            'updated_by_user_id' => $request->user()->id,
        ]));

        return response()->json($this->toRow($lead->load('updatedBy:id,name')), 201);
    }

    /** PATCH /api/leads/{id} — inline cell update */
    public function update(Request $request, int $id)
    {
        $lead = Lead::findOrFail($id);
        $data = $this->validated($request, creating: false);

        $lead->fill($data);
        $lead->updated_by_user_id = $request->user()->id;
        $lead->save();

        return response()->json($this->toRow($lead->load('updatedBy:id,name')));
    }

    /** DELETE /api/leads/{id} */
    public function destroy(int $id)
    {
        Lead::findOrFail($id)->delete();
        return response()->noContent();
    }

    // ---------------------------------------------------------------------

    private function validated(Request $request, bool $creating): array
    {
        $rules = [
            'name'       => ['sometimes', 'nullable', 'string', 'max:200'],
            'address'    => ['sometimes', 'nullable', 'string', 'max:500'],
            'phone'      => ['sometimes', 'nullable', 'string', 'max:50'],
            'lead_type'   => ['sometimes', 'nullable', 'string', 'in:' . implode(',', self::LEAD_TYPES)],
            'source_type' => ['sometimes', 'nullable', 'string', 'in:' . implode(',', self::SOURCE_TYPES)],
            'home_price' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:1000000000'], // dollars (up to $1B)
            'email'      => ['sometimes', 'nullable', 'email', 'max:200'],
            'notes'      => ['sometimes', 'nullable', 'string', 'max:10000'],
        ];

        $validated = Validator::make($request->all(), $rules)->validate();

        // home_price (dollars) → home_price_cents (int)
        if (array_key_exists('home_price', $validated)) {
            $validated['home_price_cents'] = $validated['home_price'] === null
                ? null
                : (int) round(((float) $validated['home_price']) * 100);
            unset($validated['home_price']);
        }

        return $validated;
    }

    private function toRow(Lead $lead): array
    {
        return [
            'id'                 => $lead->id,
            'name'               => $lead->name,
            'address'            => $lead->address,
            'phone'              => $lead->phone,
            'lead_type'          => $lead->lead_type,
            'source_type'        => $lead->source_type,
            'home_price'         => $lead->home_price_cents !== null ? $lead->home_price_cents / 100 : null,
            'email'              => $lead->email,
            'notes'              => $lead->notes,
            'updated_at'         => $lead->updated_at?->toIso8601String(),
            'updated_by_name'    => $lead->updatedBy?->name,
        ];
    }
}
