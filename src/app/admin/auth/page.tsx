// src/app/admin/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

export default function AuthPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });
    const [isLoading, setIsLoading] = useState(false);

    const handleAuth = async (action: 'login' | 'signup') => {
        setIsLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const response = await fetch(`/api/admin/auth/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'An unknown server error occurred.');
            }

            setMessage({ type: 'success', text: data.message });

            // SIMPLIFIED REDIRECT: Just push to the new route.
            setTimeout(() => {
                router.push('/admin');
            }, 1000);

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
            setMessage({ type: 'error', text: errorMessage });
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-muted/40">
            <Tabs defaultValue="login" className="w-[400px]">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">Login</TabsTrigger>
                    <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                <Card className="mt-4">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">UniPlateTracker Admin</CardTitle>
                        <CardDescription>Sign in or create your admin account.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {message.text && (
                            <Alert variant={message.type === 'success' ? 'default' : 'destructive'} className={message.type === 'success' ? 'bg-green-100 dark:bg-green-900/50 border-green-300 dark:border-green-800' : ''}>
                                <AlertTitle>{message.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
                                <AlertDescription>{message.text}</AlertDescription>
                            </Alert>
                        )}
                        <div className="space-y-2">
                            <Input id="email" type="email" placeholder="george@hgmartist.net" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} />
                        </div>
                        <div className="space-y-2">
                            <Input id="password" type="password" placeholder="••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} />
                        </div>

                        <TabsContent value="login" className="space-y-0">
                            <Button onClick={() => handleAuth('login')} disabled={isLoading} className="w-full">
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Login
                            </Button>
                        </TabsContent>
                        <TabsContent value="signup" className="space-y-0">
                            <Button onClick={() => handleAuth('signup')} disabled={isLoading} className="w-full">
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign Up
                            </Button>
                        </TabsContent>
                    </CardContent>
                </Card>
            </Tabs>
        </div>
    );
}