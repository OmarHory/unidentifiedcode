import { useEffect, useState } from 'react';
import logger from '../utils/logger';

export default function ErrorTest() {
  const [errorTriggered, setErrorTriggered] = useState(false);

  // Function to trigger a JavaScript error
  const triggerError = () => {
    logger.info('About to trigger a frontend error');
    // This will cause an error
    const nullObject = null;
    nullObject.someProperty = 'This will throw';
  };

  // Function to trigger an unhandled promise rejection
  const triggerPromiseError = () => {
    logger.info('About to trigger an unhandled promise rejection');
    // This creates a promise that will reject
    new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error('This is a test promise rejection'));
      }, 100);
    });
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Error Testing Page</h1>
      
      <div className="space-y-6">
        <div className="p-4 bg-gray-100 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">JavaScript Error Test</h2>
          <p className="mb-4">Click the button below to trigger a JavaScript error that will be logged.</p>
          <button 
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            onClick={triggerError}
          >
            Trigger JavaScript Error
          </button>
        </div>

        <div className="p-4 bg-gray-100 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Promise Rejection Test</h2>
          <p className="mb-4">Click the button below to trigger an unhandled promise rejection.</p>
          <button 
            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
            onClick={triggerPromiseError}
          >
            Trigger Unhandled Promise Rejection
          </button>
        </div>

        <div className="p-4 bg-gray-100 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Manual Log Test</h2>
          <p className="mb-4">Click the buttons below to manually log messages at different levels.</p>
          <div className="space-x-2">
            <button 
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              onClick={() => logger.info('Manual info log from error test page')}
            >
              Log Info
            </button>
            <button 
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
              onClick={() => logger.warn('Manual warning log from error test page')}
            >
              Log Warning
            </button>
            <button 
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              onClick={() => logger.error('Manual error log from error test page')}
            >
              Log Error
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 