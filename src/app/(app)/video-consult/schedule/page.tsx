
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, User, Video, ArrowLeft } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function SchedulePage() {
  const [formData, setFormData] = useState({
    patientName: '',
    patientEmail: '',
    consultationDate: '',
    consultationTime: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Use the API to create a consultation
      const response = await fetch('/api/consultations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to schedule consultation');
      }
      
      toast({
        title: "Consultation Scheduled!",
        description: `Your consultation has been scheduled. Room ID: ${result.consultation.roomId}`,
      });

      // Reset form
      setFormData({
        patientName: '',
        patientEmail: '',
        consultationDate: '',
        consultationTime: '',
        notes: ''
      });

      // In a real app, you would redirect to the video consultation page
      // with the generated room ID
    } catch (error) {
        toast({
        variant: 'destructive',
          title: "Scheduling Failed",
        description: error instanceof Error ? error.message : "There was an error scheduling your consultation. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = formData.patientName && formData.patientEmail && 
                     formData.consultationDate && formData.consultationTime;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/video-consult" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Video Consultation
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Schedule Consultation</h1>
          <p className="text-gray-600">Book your video consultation with a healthcare professional</p>
      </div>

      <Card className="shadow-lg">
            <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span>Consultation Details</span>
              </CardTitle>
              <CardDescription>
              Fill in the details below to schedule your video consultation
              </CardDescription>
            </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Patient Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center space-x-2">
                  <User className="w-5 h-5 text-blue-600" />
                  <span>Patient Information</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="patientName">Full Name *</Label>
                    <Input
                      id="patientName"
                      name="patientName"
                      value={formData.patientName}
                      onChange={handleInputChange}
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="patientEmail">Email Address *</Label>
                    <Input
                      id="patientEmail"
                      name="patientEmail"
                      type="email"
                      value={formData.patientEmail}
                      onChange={handleInputChange}
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Consultation Time */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span>Consultation Time</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="consultationDate">Date *</Label>
                    <Input
                      id="consultationDate"
                  name="consultationDate"
                      type="date"
                      value={formData.consultationDate}
                      onChange={handleInputChange}
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="consultationTime">Time *</Label>
                    <Input
                      id="consultationTime"
                      name="consultationTime"
                      type="time"
                      value={formData.consultationTime}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
                        </div>

              {/* Additional Notes */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Additional Notes</h3>
                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Any additional information about your consultation..."
                    className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className="w-full"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Scheduling...
                  </>
                ) : (
                  <>
                      <Video className="w-4 h-4 mr-2" />
                      Schedule Consultation
                  </>
                )}
              </Button>
              </div>
          </form>
          </CardContent>
        </Card>

        {/* Information Card */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>What to Expect</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Calendar className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold">Confirmation Email</h4>
                  <p className="text-sm text-gray-600">You'll receive a confirmation email with your consultation details and room ID.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Video className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold">Video Call</h4>
                  <p className="text-sm text-gray-600">Join the video call using the provided room ID at your scheduled time.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-semibold">Professional Care</h4>
                  <p className="text-sm text-gray-600">Connect with qualified healthcare professionals for personalized care.</p>
                </div>
              </div>
            </div>
          </CardContent>
      </Card>
      </div>
    </div>
  );
}

    