
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Video, Home } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Simple Header */}
      <header className="sticky top-0 z-30 flex h-[60px] items-center gap-4 border-b bg-white px-4 sm:px-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Video className="w-6 h-6 text-blue-600" />
          <Link href="/">
            <h1 className="font-semibold text-lg text-gray-900">Video Consultation</h1>
          </Link>
        </div>
        
        {/* Navigation */}
        <nav className="ml-8 flex items-center gap-4">
          <Link 
            href="/" 
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
          <Link 
            href="/video-consult" 
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <Video className="w-4 h-4" />
            Video Calls
          </Link>
        </nav>
        
        <div className="ml-auto flex items-center gap-4">
          {/* Placeholder for user menu - can be expanded later */}
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-blue-600">U</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
