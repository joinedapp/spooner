import React, {
  createContext,
  forwardRef,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import PropTypes from 'prop-types';
import { useUncontrolled } from 'uncontrollable';

import validate from './validation';

const Context = createContext({
  error: {},
  set() {},
  unset() {},
  value: {},
});

const { Provider } = Context;

const useForm = () => {
  return useContext(Context);
};

const useStatus = nextState => {
  const state = useRef({ error: undefined, value: undefined });

  const accessor = new Proxy(
    {},
    {
      get(target, prop) {
        return state.current[prop];
      },
    },
  );

  const setState = useCallback(
    (error, value) => {
      state.current = { error, value };
    },
    [state],
  );

  const setError = useCallback(
    error => {
      setState(error, state.current.value);
    },
    [setState],
  );

  const setValue = useCallback(
    value => {
      setState(state.current.error, value);
    },
    [setState],
  );

  if (
    JSON.stringify(nextState.error) !== JSON.stringify(accessor.error) ||
    JSON.stringify(nextState.value) !== JSON.stringify(accessor.value)
  ) {
    setState(nextState.error, nextState.value);
  }

  return [accessor, setValue, setError];
};

const useValue = name => {
  const { set, unset, ...context } = useForm();

  return { error: context.error[name], value: context.value[name] };
};

const Form = ({
  children,
  constraint,
  forwardedRef,
  onInvalid = () => {},
  onSubmit = () => {},
  ...input
}) => {
  const { onChange, onErrorChange, ...rest } = useUncontrolled(input, {
    error: 'onErrorChange',
    value: 'onChange',
  });

  const [status, setValue, setError] = useStatus({
    error: rest.error || {},
    value: rest.value || {},
  });

  const isMounted = useRef(true);

  const handleChange = useCallback(
    (name, after, before) => {
      onChange(after, before);

      const error = { ...status.error };
      delete error[name];

      if (JSON.stringify(error) !== JSON.stringify(status.error)) {
        setError(error);
        onErrorChange(error);
      }
    },
    [onChange, onErrorChange],
  );

  const handleSubmit = event => {
    event.preventDefault();

    const error = validate(status.value, constraint);
    const isValid = Object.keys(error).length === 0;

    if (isValid) {
      onSubmit(status.value);
    } else {
      onErrorChange(error);

      onInvalid(error);
    }
  };

  const set = useCallback(
    (name, value) => {
      if (isMounted.current) {
        const before = status.value;
        const after = { ...before, [name]: value };

        setValue(after);
        handleChange(name, after, before);
      }
    },
    [handleChange, isMounted],
  );

  const unset = useCallback(
    name => {
      if (isMounted.current) {
        const before = status.value;
        const after = { ...before };
        delete after[name];

        setValue(after);
        handleChange(name, after, before);
      }
    },
    [handleChange, isMounted],
  );

  const context = useMemo(
    () => ({ error: status.error, set, unset, value: status.value }),
    [JSON.stringify(status.error), set, unset, JSON.stringify(status.value)],
  );

  useEffect(() => {
    // componentDidMount

    return () => {
      // componentWillUnmount
      isMounted.current = false;
    };
  }, []);

  const props = { ...input };
  delete props.error;
  delete props.onChange;
  delete props.onErrorChange;
  delete props.value;

  return (
    <form noValidate {...props} ref={forwardedRef} onSubmit={handleSubmit}>
      <Provider value={context}>{children}</Provider>
    </form>
  );
};

Form.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
  constraint: PropTypes.object,
  error: PropTypes.object,
  forwardedRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(PropTypes.element) }),
  ]),
  onChange: PropTypes.func,
  onErrorChange: PropTypes.func,
  onInvalid: PropTypes.func,
  onSubmit: PropTypes.func,
  value: PropTypes.object,
};

export { Provider, useForm, useStatus, useValue };

export default memo(
  forwardRef((props, ref) => <Form {...props} forwardedRef={ref} />),
);
