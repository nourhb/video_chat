

"use client";

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, Calendar, Users } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Video Consultation Platform
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Connect with healthcare professionals through secure, high-quality video consultations.
            Schedule appointments, join calls, and manage your healthcare from anywhere.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Video className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle>Video Consultations</CardTitle>
              <CardDescription>
                Start or join video calls with healthcare professionals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/video-consult">
                <Button className="w-full" size="lg">
                  Start Consultation
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <CardTitle>Schedule Appointments</CardTitle>
              <CardDescription>
                Book and manage your consultation appointments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/video-consult/schedule">
                <Button className="w-full" size="lg" variant="outline">
                  Schedule Now
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <CardTitle>Manage Calls</CardTitle>
              <CardDescription>
                View and manage your consultation history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/video-consult">
                <Button className="w-full" size="lg" variant="outline">
                  View History
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold mb-2">Schedule</h3>
              <p className="text-gray-600">Book your consultation with a healthcare professional</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold mb-2">Connect</h3>
              <p className="text-gray-600">Join the secure video call at your scheduled time</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold mb-2">Consult</h3>
              <p className="text-gray-600">Receive professional healthcare advice and care</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
