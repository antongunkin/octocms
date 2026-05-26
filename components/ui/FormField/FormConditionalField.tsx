'use client';

import React, { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../Tabs/Tabs';

import type { CollectionField, ConditionalCollectionField } from '../../../admin/types';
import { cn } from '../../../lib/utils';
import { jsonFieldValueToFormString } from '../../../lib/jsonField';

import { Field } from './Field';
import FormBooleanField from './FormBooleanField';
import FormColorField from './FormColorField';
import FormDatetimeField from './FormDatetimeField';
import FormImageField from './FormImageField';
import FormJsonField from './FormJsonField';
import FormMarkdownField from './FormMarkdownField';
import FormNumberField from './FormNumberField';
import FormReferenceField from './FormReferenceField';
import FormSelectField from './FormSelectField';
import FormStringField from './FormStringField';
import FormStringListField from './FormStringListField';
import FormTextField from './FormTextField';
import FormUrlField from './FormUrlField';

type FormConditionalFieldProps = {
  name: string;
  label: string;
  def: ConditionalCollectionField;
  value: unknown;
  required?: boolean;
  hint?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  onClearFieldError?: (fieldName: string) => void;
};

function parseBranchValues(value: unknown, branches: ConditionalCollectionField['conditional']['branches']) {
  if (typeof value === 'object' && value && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* fall through */
    }
  }
  // Return empty defaults
  const defaults: Record<string, unknown> = {};
  for (const b of branches) {
    defaults[b.key] = b.fields ? {} : '';
  }
  return defaults;
}

const FormConditionalField = ({
  name,
  label,
  def,
  value,
  required,
  hint,
  error,
  fieldErrors,
  onClearFieldError,
}: FormConditionalFieldProps) => {
  const branches = def.conditional.branches;
  const initialValues = useMemo(() => parseBranchValues(value, branches), [value, branches]);
  const [activeTab, setActiveTab] = useState(branches[0]?.key ?? '');

  // Serialize the full conditional value as hidden JSON for form submission
  const serialized = useMemo(() => JSON.stringify(initialValues), [initialValues]);

  return (
    <Field
      label={label}
      schema="conditional"
      required={required}
      hint={hint}
      error={error}
      className="octo-ff-conditional"
    >
      <input type="hidden" name={name} value={serialized} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="octo-ff-conditional__tabs">
        <TabsList className="octo-ff-conditional__tablist">
          {branches.map((branch) => {
            const branchPrefix = `${name}.${branch.key}`;
            const hasBranchError = fieldErrors
              ? Object.keys(fieldErrors).some((k) => k.startsWith(branchPrefix))
              : false;

            return (
              <TabsTrigger
                key={branch.key}
                value={branch.key}
                className={cn(
                  'octo-ff-conditional__tab',
                  hasBranchError && 'octo-ff-conditional__tab octo-ff-conditional__tab--error',
                )}
              >
                {branch.label}
                <span className="octo-ff-conditional__tab-key">{branch.key}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {branches.map((branch) => (
          <TabsContent key={branch.key} value={branch.key} className="octo-ff-conditional__content">
            {branch.collection ? (
              <ReferenceBranchEditor
                parentName={name}
                branchKey={branch.key}
                collection={branch.collection}
                value={initialValues[branch.key]}
                fieldErrors={fieldErrors}
                onClearFieldError={onClearFieldError}
              />
            ) : branch.fields ? (
              <InlineBranchEditor
                parentName={name}
                branchKey={branch.key}
                fields={branch.fields}
                values={
                  typeof initialValues[branch.key] === 'object' && initialValues[branch.key]
                    ? (initialValues[branch.key] as Record<string, unknown>)
                    : {}
                }
                fieldErrors={fieldErrors}
                onClearFieldError={onClearFieldError}
              />
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </Field>
  );
};

// ---------------------------------------------------------------------------
// Inline branch editor — renders form fields for the branch's field definitions
// ---------------------------------------------------------------------------

type InlineBranchEditorProps = {
  parentName: string;
  branchKey: string;
  fields: Record<string, CollectionField>;
  values: Record<string, unknown>;
  fieldErrors?: Record<string, string>;
  onClearFieldError?: (fieldName: string) => void;
};

function InlineBranchEditor({
  parentName,
  branchKey,
  fields,
  values,
  fieldErrors,
  onClearFieldError,
}: InlineBranchEditorProps) {
  return (
    <div className="octo-ff-conditional__branch">
      {Object.entries(fields).map(([key, def]) => {
        const rawVal = values[key];
        const errorKey = `${parentName}.${branchKey}.${key}`;
        const err = fieldErrors?.[errorKey];
        const common = {
          hint: def.hint,
          error: err,
          required: def.required,
        };

        // Use a unique compound name so nested fields don't collide
        const fieldName = `${parentName}.${branchKey}.${key}`;

        const formTextValue =
          def.format === 'json'
            ? jsonFieldValueToFormString(rawVal)
            : rawVal === undefined || rawVal === null
              ? ''
              : String(rawVal);

        switch (def.format) {
          case 'string':
            return def.list === true ? (
              <FormStringListField
                key={fieldName}
                name={fieldName}
                label={def.label}
                value={rawVal}
                {...common}
                onClearError={onClearFieldError}
              />
            ) : (
              <FormStringField key={fieldName} name={fieldName} label={def.label} value={formTextValue} {...common} />
            );
          case 'text':
            return (
              <FormTextField
                key={fieldName}
                name={fieldName}
                label={def.label}
                value={formTextValue}
                rows={def.rows}
                {...common}
                onClearError={onClearFieldError}
              />
            );
          case 'url':
            return (
              <FormUrlField
                key={fieldName}
                name={fieldName}
                label={def.label}
                value={formTextValue}
                {...common}
                onClearError={onClearFieldError}
              />
            );
          case 'color':
            return (
              <FormColorField
                key={fieldName}
                name={fieldName}
                label={def.label}
                value={formTextValue}
                allowInput={def.allowInput}
                {...common}
                onClearError={onClearFieldError}
              />
            );
          case 'number':
            return (
              <FormNumberField
                key={fieldName}
                name={fieldName}
                label={def.label}
                value={formTextValue}
                min={def.min}
                max={def.max}
                step={def.step}
                valueType={def.valueType}
                {...common}
              />
            );
          case 'datetime':
            return (
              <FormDatetimeField
                key={fieldName}
                name={fieldName}
                label={def.label}
                value={formTextValue}
                dateOnly={def.dateOnly}
                defaultNow={def.defaultNow}
                {...common}
              />
            );
          case 'markdown':
            return (
              <FormMarkdownField
                key={fieldName}
                name={fieldName}
                label={def.label}
                value={formTextValue}
                {...common}
                onClearError={onClearFieldError}
              />
            );
          case 'boolean':
            return (
              <FormBooleanField
                key={fieldName}
                name={fieldName}
                label={def.label}
                value={formTextValue}
                trueLabel={def.booleanLabels?.true}
                falseLabel={def.booleanLabels?.false}
                {...common}
              />
            );
          case 'image':
            return (
              <FormImageField
                key={fieldName}
                name={fieldName}
                label={def.label}
                value={formTextValue}
                {...common}
                onClearError={onClearFieldError}
              />
            );
          case 'reference':
            return (
              <FormReferenceField
                key={fieldName}
                name={fieldName}
                label={def.label}
                value={formTextValue}
                collection={def.collection}
                reference={def.reference}
                {...common}
                onClearError={onClearFieldError}
              />
            );
          case 'json':
            return (
              <FormJsonField
                key={fieldName}
                name={fieldName}
                label={def.label}
                value={formTextValue}
                {...common}
                onClearError={onClearFieldError}
              />
            );
          case 'select':
            return (
              <FormSelectField
                key={fieldName}
                name={fieldName}
                label={def.label}
                value={rawVal}
                options={def.options}
                multiple={def.multiple === true}
                {...common}
                onClearError={onClearFieldError}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reference branch editor — select/create an entry from the target collection
// ---------------------------------------------------------------------------

type ReferenceBranchEditorProps = {
  parentName: string;
  branchKey: string;
  collection: string;
  value: unknown;
  fieldErrors?: Record<string, string>;
  onClearFieldError?: (fieldName: string) => void;
};

function ReferenceBranchEditor({
  parentName,
  branchKey,
  collection,
  value,
  fieldErrors,
  onClearFieldError,
}: ReferenceBranchEditorProps) {
  const refValue = typeof value === 'string' ? value : '';
  const errorKey = `${parentName}.${branchKey}`;
  const err = fieldErrors?.[errorKey];

  return (
    <FormReferenceField
      name={`${parentName}.${branchKey}`}
      label={`${collection} entry`}
      value={refValue}
      reference={{ collections: [collection as any], cardinality: 'one' }}
      error={err}
      onClearError={onClearFieldError}
    />
  );
}

export default FormConditionalField;
