import { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from '../components/LoginForm';

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated()) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  return (
    <>
      <Head>
        <title>Login - SpeakCode</title>
        <meta name="description" content="Log in to your SpeakCode account" />
      </Head>

      <main className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              SpeakCode
            </h1>
            <p className="text-gray-400 mt-2">Log in to continue</p>
          </div>

          <LoginForm />
          
          <div className="mt-4 text-center text-sm text-gray-500">
            <p>
              In development mode, you can log in with any username and password.
            </p>
          </div>
        </div>
      </main>
    </>
  );
} 