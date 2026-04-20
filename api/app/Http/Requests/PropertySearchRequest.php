<?php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PropertySearchRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'q'              => ['nullable', 'string', 'max:200'],
            'city'           => ['nullable', 'string', 'max:120'],
            'state'          => ['nullable', 'string', 'size:2'],
            'zip'            => ['nullable', 'string', 'max:10'],
            'property_type'  => ['nullable', 'in:single_family,multi_family,condo,townhouse,land,commercial'],
            'beds_min'       => ['nullable', 'integer', 'min:0'],
            'beds_max'       => ['nullable', 'integer', 'min:0'],
            'baths_min'      => ['nullable', 'numeric', 'min:0'],
            'sqft_min'       => ['nullable', 'integer', 'min:0'],
            'sqft_max'       => ['nullable', 'integer', 'min:0'],
            'year_built_min' => ['nullable', 'integer', 'min:1800'],
            'year_built_max' => ['nullable', 'integer', 'max:2100'],
            'value_min'      => ['nullable', 'numeric', 'min:0'],
            'value_max'      => ['nullable', 'numeric', 'min:0'],
            'bbox'           => ['nullable', 'string'],
            'sort'           => ['nullable', 'in:recent,value_asc,value_desc,sqft_desc'],
            'per_page'       => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
