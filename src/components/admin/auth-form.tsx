"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, FlaskConical } from "lucide-react";

/**
 * The sign-in form.
 *
 * Split out of the page so the page itself can stay a server component and
 * read DEMO_MODE from the environment at request time. Doing it the other way
 * round would mean a NEXT_PUBLIC_ variable, which Next inlines at build time,
 * and the demo and the real deployments are meant to run the same image.
 */
export function AuthForm({ demoCredentials }: { demoCredentials: { email: string; password: string } | null }) {
    const isDemo = demoCredentials !== null;

    // Prefilled on the demo. Printing credentials on the page and then making
    // someone retype them is a pointless piece of ceremony.
    const [email, setEmail] = useState(demoCredentials?.email ?? "");
    const [password, setPassword] = useState(demoCredentials?.password ?? "");
    const [message, setMessage] = useState({ type: "", text: "" });
    const [isLoading, setIsLoading] = useState(false);

    const handleAuth = async (action: "login" | "signup") => {
        setIsLoading(true);
        setMessage({ type: "", text: "" });

        try {
            const response = await fetch(`/api/admin/auth/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "An unknown server error occurred.");

            setMessage({ type: "success", text: data.message });
            window.location.assign("/admin");
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            setMessage({ type: "error", text: errorMessage });
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
            {/*
              * The signup tab is not rendered at all on the demo rather than
              * being rendered disabled. The API refuses signup outright there,
              * so a tab that exists only to explain itself is worse than one
              * that was never offered.
              */}
            <Tabs defaultValue="login" className="w-full max-w-[400px]">
                {!isDemo && (
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="login">Login</TabsTrigger>
                        <TabsTrigger value="signup">Sign up</TabsTrigger>
                    </TabsList>
                )}

                <Card className="mt-4">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">UniPlateTracker admin</CardTitle>
                        <CardDescription>
                            {isDemo ? "Signed-out view of the demo admin area." : "Sign in or create your admin account."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isDemo && (
                            <Alert>
                                <FlaskConical className="h-4 w-4" aria-hidden />
                                <AlertTitle>Demo account</AlertTitle>
                                <AlertDescription className="space-y-1">
                                    <p>
                                        Sign in with{" "}
                                        <span className="font-mono font-medium text-foreground">{demoCredentials.email}</span>{" "}
                                        /{" "}
                                        <span className="font-mono font-medium text-foreground">{demoCredentials.password}</span>
                                        . Already filled in below.
                                    </p>
                                    <p>
                                        The dashboard is fully browsable, but adding and revoking admins is disabled
                                        here. All the data is synthetic.
                                    </p>
                                </AlertDescription>
                            </Alert>
                        )}

                        {message.text && (
                            <Alert
                                variant={message.type === "success" ? "default" : "destructive"}
                                className={message.type === "success" ? "bg-success/10 border-success/40 text-success" : ""}
                            >
                                <AlertTitle>{message.type === "success" ? "Success" : "Error"}</AlertTitle>
                                <AlertDescription>{message.text}</AlertDescription>
                            </Alert>
                        )}
                        <div className="space-y-2">
                            <label htmlFor="email" className="sr-only">
                                Email address
                            </label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="admin@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading}
                                autoComplete="email"
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="password" className="sr-only">
                                Password
                            </label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                                autoComplete="current-password"
                            />
                        </div>

                        <TabsContent value="login" className="space-y-0">
                            <Button onClick={() => handleAuth("login")} disabled={isLoading} className="w-full">
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Login
                            </Button>
                        </TabsContent>
                        {!isDemo && (
                            <TabsContent value="signup" className="space-y-0">
                                <Button onClick={() => handleAuth("signup")} disabled={isLoading} className="w-full">
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Sign up
                                </Button>
                            </TabsContent>
                        )}
                    </CardContent>
                </Card>
            </Tabs>
        </div>
    );
}
