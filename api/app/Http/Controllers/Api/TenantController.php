<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;

class TenantController extends Controller
{
    public function update(Request $request)
    {
        $data = $request->validate([
            'name'     => ['sometimes', 'string', 'max:160'],
            'industry' => ['nullable', 'string', 'max:120'],
            'phone'    => ['nullable', 'string', 'max:40'],
            'address'  => ['nullable', 'string', 'max:255'],
        ]);

        $tenant = $request->user()->tenant;
        $tenant->update($data);

        return response()->json($tenant->fresh());
    }

    public function employees(Request $request)
    {
        return response()->json(
            User::where('tenant_id', $request->user()->tenant_id)
                ->select('id', 'name', 'email', 'role', 'created_at')
                ->latest()
                ->get()
        );
    }
}
