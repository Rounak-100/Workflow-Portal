import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Form } from '@bpmn-io/form-js-viewer';
import '@bpmn-io/form-js-viewer/dist/assets/form-js.css';

export type FormSubmitResult = {
  data: Record<string, unknown>;
  errors: unknown[];
};

export type FormHandle = {
  submit: () => Promise<FormSubmitResult>;
};

type FormViewerProps = {
  schema: object;
  data?: Record<string, unknown>;
};

/**
 * Renders the Camunda form schema and exposes a normalized submit result.
 * form-js returns its validation errors as a keyed object, whereas the
 * surrounding pages consume an array and check `errors.length`.
 */
const EMPTY_DATA: Record<string, unknown> = {};

const FormViewer = forwardRef<FormHandle, FormViewerProps>(
  ({ schema, data = EMPTY_DATA }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const formRef = useRef<Form | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
      if (!containerRef.current) return;

      let active = true;
      const form = new Form({ container: containerRef.current });
      formRef.current = form;
      setError('');

      form.importSchema(schema, data).catch(() => {
        if (active) setError('The form could not be shown.');
      });

      return () => {
        active = false;
        formRef.current = null;
        form.destroy();
      };
    }, [schema, data]);

    useImperativeHandle(ref, () => ({
      submit: async (): Promise<FormSubmitResult> => {
        if (!formRef.current) {
          return {
            data: {},
            errors: [{ message: 'Form not ready' }],
          };
        }

        const result = await formRef.current.submit();
        return {
          data: result.data ?? {},
          errors: Object.values(result.errors ?? {}).flat(),
        };
      },
    }));

    return (
      <>
        {error && <div className="text-danger" role="alert">{error}</div>}
        <div ref={containerRef} className="wf-form" />
      </>
    );
  },
);

FormViewer.displayName = 'FormViewer';

export default FormViewer;
