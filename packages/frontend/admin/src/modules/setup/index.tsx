import { Form } from './form';
import logo from './logo.svg';

export function Auth() {
  // const emailRef = useRef<HTMLInputElement>(null);
  // const passwordRef = useRef<HTMLInputElement>(null);

  return (
    <div className="w-full lg:grid lg:grid-cols-2 h-screen">
      <div className="flex items-center justify-center py-12 h-full">
        <Form />
      </div>
      <div className="hidden lg:block relative overflow-hidden ">
        <img
          src={logo}
          alt="Image"
          className="absolute object-right-bottom bottom-0 right-0 h-3/4"
        />
      </div>
    </div>
  );
}

export { Auth as Component };
