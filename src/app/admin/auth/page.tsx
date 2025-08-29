// src/app/admin/auth/page.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AdminAuthPage() {
    const router = useRouter();
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [message, setMessage] = React.useState("");
    const [messageType, setMessageType] = React.useState<"error" | "success">("error");

    const handleResponse = (data: any, res: Response, successMessage: string, successRedirect: string) => {
        if (res.ok) {
            setMessageType("success");
            setMessage(successMessage);
            router.push(successRedirect);
        } else {
            setMessageType("error");
            setMessage(data.error || data.message || "An unknown error occurred.");
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage("");
        const res = await fetch("/api/admin/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        handleResponse(data, res, "Login successful!", "/admin");
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage("");
        const res = await fetch("/api/admin/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        handleResponse(data, res, "Signup successful! Redirecting to login...", "/admin/auth");
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
            <Tabs defaultValue="login" className="w-full max-w-md">
                <Card>
                    <CardHeader className="text-center">
                        <CardTitle>UniPlateTracker Admin</CardTitle>
                        <CardDescription>Sign in or create your admin account.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="login">Login</TabsTrigger>
                            <TabsTrigger value="signup">Sign Up</TabsTrigger>
                        </TabsList>
                        {message && (
                            <Alert variant={messageType === 'error' ? 'destructive' : 'default'} className={messageType === 'success' ? 'bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700' : ''}>
                                <AlertTitle>{messageType === 'error' ? 'Error' : 'Success'}</AlertTitle>
                                <AlertDescription>{message}</AlertDescription>
                            </Alert>
                        )}
                        <TabsContent value="login">
                            <form onSubmit={handleLogin} className="space-y-4">
                                <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required/>
                                <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}/>
                                <Button type="submit" className="w-full">Login</Button>
                            </form>
                        </TabsContent>
                        <TabsContent value="signup">
                            <form onSubmit={handleSignup} className="space-y-4">
                                <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required/>
                                <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}/>
                                <Button type="submit" className="w-full">Sign Up</Button>
                            </form>
                        </TabsContent>
                    </CardContent>
                </Card>
            </Tabs>
        </main>
    );
}