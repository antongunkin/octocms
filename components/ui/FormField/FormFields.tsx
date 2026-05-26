'use client';

import React, { useMemo } from 'react';

import type { Config } from '../../../admin/types';
import { useConfig } from '../../../hooks/useConfig';
import { jsonFieldValueToFormString } from '../../../lib/jsonField';

import { ErrorBoundary } from '../../ErrorBoundary/ErrorBoundary';
import FormBooleanField from './FormBooleanField';
import FormColorField from './FormColorField';
import FormConditionalField from './FormConditionalField';
import FormDatetimeField from './FormDatetimeField';
import FormImageField from './FormImageField';
import FormJsonField from './FormJsonField';
import FormMarkdownField from './FormMarkdownField';
import FormRichTextField from './FormRichTextField';
import FormNumberField from './FormNumberField';
import FormReferenceField from './FormReferenceField';
import FormSelectField from './FormSelectField';
import FormSlugField from './FormSlugField';
import FormStringField from './FormStringField';
import FormStringListField from './FormStringListField';
import FormTextField from './FormTextField';
import FormUrlField from './FormUrlField';

import { getEntryTitleField } from '../../../admin/actions/utils';
import { richTextEditorConfig } from '../../../lib/richtextFieldConfig';

import { SelectedFile } from '../../../types';

type FormFieldsProps = {
  selectedFile: SelectedFile | undefined;
  fields: Record<string, unknown>;
  fieldErrors?: Record<string, string>;
  onClearFieldError?: (fieldName: string) => void;
};

const FormFields = ({ selectedFile, fields, fieldErrors, onClearFieldError }: FormFieldsProps) => {
  const config = useConfig();
  const fieldsSys = useMemo(() => {
    return config.collections[selectedFile?.type as keyof Config['collections']]?.fields ?? {};
  }, [selectedFile, config.collections]);

  return (
    <div>
      {Object.keys(fieldsSys).map((key) => {
        const rawVal = fields[key];
        const def = fieldsSys[key];
        if (!def) {
          return null;
        }

        const label = def.label || key;
        const err = fieldErrors?.[key];
        const common = {
          hint: def.hint,
          error: err,
          required: def.required,
        };

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
                key={`${selectedFile?.path ?? ''}-${key}`}
                name={key}
                label={label}
                value={rawVal}
                {...common}
                onClearError={onClearFieldError}
              />
            ) : (
              <FormStringField key={key} name={key} label={label} value={formTextValue} {...common} />
            );
          case 'text':
            return (
              <FormTextField
                key={key}
                name={key}
                label={label}
                value={formTextValue}
                rows={def.rows}
                {...common}
                onClearError={onClearFieldError}
              />
            );
          case 'url':
            return (
              <FormUrlField
                key={key}
                name={key}
                label={label}
                value={formTextValue}
                {...common}
                onClearError={onClearFieldError}
              />
            );
          case 'color':
            return (
              <FormColorField
                key={key}
                name={key}
                label={label}
                value={formTextValue}
                allowInput={def.allowInput}
                {...common}
                onClearError={onClearFieldError}
              />
            );
          case 'number':
            return (
              <FormNumberField
                key={key}
                name={key}
                label={label}
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
                key={key}
                name={key}
                label={label}
                value={formTextValue}
                dateOnly={def.dateOnly}
                defaultNow={def.defaultNow}
                {...common}
              />
            );
          case 'markdown':
            return (
              <FormMarkdownField
                key={key}
                name={key}
                label={label}
                value={formTextValue}
                {...common}
                onClearError={onClearFieldError}
              />
            );
          case 'boolean':
            return (
              <FormBooleanField
                key={key}
                name={key}
                label={label}
                value={formTextValue}
                trueLabel={def.booleanLabels?.true}
                falseLabel={def.booleanLabels?.false}
                {...common}
              />
            );
          case 'image':
            return (
              <FormImageField
                key={key}
                name={key}
                label={label}
                value={formTextValue}
                {...common}
                onClearError={onClearFieldError}
              />
            );
          case 'reference':
            return (
              <ErrorBoundary key={key} label="reference field" resetKeys={[key]}>
                <FormReferenceField
                  label={label}
                  name={key}
                  value={formTextValue}
                  collection={def.collection}
                  reference={def.reference}
                  {...common}
                  onClearError={onClearFieldError}
                />
              </ErrorBoundary>
            );
          case 'json':
            return (
              <FormJsonField
                key={key}
                name={key}
                label={label}
                value={formTextValue}
                {...common}
                onClearError={onClearFieldError}
              />
            );
          case 'slug': {
            const sourceField =
              def.slugSource ?? (selectedFile?.type ? getEntryTitleField(selectedFile.type) : undefined);
            if (!sourceField) {
              return null;
            }
            return (
              <FormSlugField
                key={`${selectedFile?.path ?? ''}-${key}`}
                name={key}
                label={label}
                value={formTextValue}
                sourceField={sourceField}
                {...common}
                onClearError={onClearFieldError}
              />
            );
          }
          case 'select':
            return (
              <FormSelectField
                key={key}
                name={key}
                label={label}
                value={rawVal}
                options={def.options}
                multiple={def.multiple === true}
                {...common}
                onClearError={onClearFieldError}
              />
            );
          case 'richtext':
            return (
              <FormRichTextField
                key={`${selectedFile?.path ?? ''}-${key}`}
                name={key}
                label={label}
                value={formTextValue}
                richtext={richTextEditorConfig(def)}
                {...common}
                onClearError={onClearFieldError}
              />
            );
          case 'conditional':
            return (
              <FormConditionalField
                key={key}
                name={key}
                label={label}
                def={def}
                value={rawVal}
                fieldErrors={fieldErrors}
                onClearFieldError={onClearFieldError}
                {...common}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
};

export default FormFields;
