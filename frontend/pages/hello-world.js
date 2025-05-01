import { useEffect } from 'react';

export default function HelloWorld() {
  useEffect(() => {
    // Browser console log
    console.log("Hello, World!");
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-4xl font-bold mb-4">Hello, World!</h1>
      <p className="text-xl">Welcome to SpeakCode's Hello World page</p>
      <p className="mt-8 text-gray-400">Check your browser console to see the Hello World message</p>
    </div>
  );
} 