import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useRouter } from 'next/router';
import { CodeBracketIcon, MicrophoneIcon, SparklesIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

export default function LandingPage() {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <Head>
        <title>SpeakCode - Voice-first AI Pair Programming</title>
        <meta name="description" content="Supercharge your coding with voice-powered AI assistance. Get expert-level pair programming without giving up control." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Navbar */}
      <header 
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          isScrolled ? 'bg-background shadow-lg' : 'bg-transparent'
        }`}
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <CodeBracketIcon className="h-8 w-8 text-primary mr-2" />
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                SpeakCode
              </span>
            </div>
            <nav className="hidden md:flex space-x-10">
              <a href="#features" className="text-gray-300 hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="text-gray-300 hover:text-white transition-colors">How It Works</a>
              <a href="#testimonials" className="text-gray-300 hover:text-white transition-colors">Testimonials</a>
            </nav>
            <div>
              <Link 
                href="/dashboard" 
                className="btn btn-primary px-6 py-2"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-32 px-6 bg-gradient-to-b from-background to-background-light">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-1/2 mb-10 md:mb-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center md:text-left"
              >
                <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
                  <span className="block">Voice-First</span>
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                    AI Pair Programming
                  </span>
                </h1>
                <p className="text-xl md:text-2xl text-gray-300 mb-8">
                  The power of a senior engineer, accessible through your voice. 
                  Propose code, discuss options, keep control.
                </p>
                <div className="flex flex-col sm:flex-row justify-center md:justify-start space-y-4 sm:space-y-0 sm:space-x-4">
                  <Link 
                    href="/dashboard" 
                    className="btn btn-primary text-lg px-8 py-3"
                  >
                    Start Coding
                  </Link>
                  <a 
                    href="#demo" 
                    className="btn btn-outline text-lg px-8 py-3"
                  >
                    See Demo
                  </a>
                </div>
              </motion.div>
            </div>
            <div className="md:w-1/2">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="relative"
              >
                <div className="relative bg-background-light rounded-lg shadow-xl overflow-hidden border border-gray-700">
                  <div className="bg-background-light border-b border-gray-700 px-4 py-2 flex items-center">
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div className="ml-4 text-sm font-mono text-gray-400">~/speakcode/project</div>
                  </div>
                  <div className="p-4 font-mono text-sm">
                    <div className="flex items-start mb-6">
                      <span className="mr-2 text-gray-500">{">"}</span>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="text-gray-300"
                      >
                        <span className="text-accent">Create</span> a React component for a todo list
                      </motion.div>
                    </div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1 }}
                      className="ml-4 p-3 bg-background rounded-md text-gray-300 border-l-2 border-primary"
                    >
                      <p className="mb-2">Here's a Todo component:</p>
                      <pre className="bg-background-light p-3 rounded overflow-x-auto text-xs">
{`import { useState } from 'react';

export default function TodoList() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');
  
  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, { text: input, completed: false }]);
      setInput('');
    }
  };

  return (
    <div className="todo-list">
      <h2>Todo List</h2>
      <div className="add-todo">
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
        />
        <button onClick={addTodo}>Add</button>
      </div>
      <ul>
        {todos.map((todo, index) => (
          <li key={index}>{todo.text}</li>
        ))}
      </ul>
    </div>
  );
}`}
                      </pre>
                      <div className="mt-2 flex justify-end space-x-2">
                        <button className="px-2 py-1 bg-green-600 text-white text-xs rounded">Apply</button>
                        <button className="px-2 py-1 bg-red-600 text-white text-xs rounded">Reject</button>
                      </div>
                    </motion.div>
                  </div>
                </div>
                <div className="absolute -top-4 -left-4 -right-4 -bottom-4 bg-primary opacity-5 rounded-lg blur-xl -z-10"></div>
                <div className="absolute -top-2 -left-2 -right-2 -bottom-2 bg-accent opacity-5 rounded-lg blur-xl -z-10"></div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-background">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Key Features</h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              SpeakCode combines voice interaction, AI assistance, and developer control
              to create the ultimate pair programming experience.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<MicrophoneIcon className="h-8 w-8" />}
              title="Voice-First Interaction"
              description="Talk to your AI pair programmer naturally. No more typing long queries or explanations."
              delay={0.1}
            />
            <FeatureCard 
              icon={<SparklesIcon className="h-8 w-8" />}
              title="Expert-Level Assistance"
              description="Get help from an AI that codes like a senior engineer, with domain-specific knowledge."
              delay={0.2}
            />
            <FeatureCard 
              icon={<ChatBubbleLeftRightIcon className="h-8 w-8" />}
              title="Natural Conversation"
              description="Discuss options, receive explanations, and collaborate just like with a human partner."
              delay={0.3}
            />
            <FeatureCard 
              icon={<CodeBracketIcon className="h-8 w-8" />}
              title="Code Suggestions"
              description="Receive complete code solutions that you can review, modify, and apply with a click."
              delay={0.4}
            />
            <FeatureCard 
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              }
              title="Full Control"
              description="You decide which code gets applied. Nothing changes without your explicit approval."
              delay={0.5}
            />
            <FeatureCard 
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              }
              title="Integrated Environment"
              description="Everything you need in one place: code editor, file manager, and AI assistant."
              delay={0.6}
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-6 bg-background-light">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              A simple workflow that enhances your productivity without getting in the way.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard 
              number="1"
              title="Create a Project"
              description="Start a new project or open an existing one. Specify technologies and preferences."
              delay={0.1}
            />
            <StepCard 
              number="2"
              title="Speak or Type"
              description="Ask questions, request code, or discuss implementation details with the AI."
              delay={0.2}
            />
            <StepCard 
              number="3"
              title="Review & Apply"
              description="Review suggested code, accept what works for you, reject what doesn't."
              delay={0.3}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-background to-background-light">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-primary/10 border border-primary/20 rounded-2xl p-10 text-center"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to code faster and smarter?
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Join thousands of developers who are already enhancing their workflow with SpeakCode.
            </p>
            <Link 
              href="/dashboard" 
              className="btn btn-primary px-8 py-3 text-lg"
            >
              Get Started Now
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 bg-background border-t border-gray-800">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-6 md:mb-0">
              <CodeBracketIcon className="h-6 w-6 text-primary mr-2" />
              <span className="text-lg font-semibold">SpeakCode</span>
            </div>
            <div className="text-sm text-gray-400">
              © {new Date().getFullYear()} SpeakCode. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

function FeatureCard({ icon, title, description, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="bg-background-light p-6 rounded-xl border border-gray-700 hover:border-gray-600 transition-colors"
    >
      <div className="text-primary mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </motion.div>
  );
}

function StepCard({ number, title, description, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="bg-background p-6 rounded-xl border border-gray-700 hover:border-gray-600 transition-colors relative"
    >
      <div className="absolute -top-4 -left-4 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold">
        {number}
      </div>
      <h3 className="text-xl font-semibold mb-2 mt-3">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </motion.div>
  );
} 