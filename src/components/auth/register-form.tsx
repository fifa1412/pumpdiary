"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AuthError, registerUser } from "@/lib/auth";

const GENERIC_ERROR = 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง';

const registerSchema = z
  .object({
    name: z.string().min(2, 'ชื่อผู้เล่นต้องมี 2-20 ตัวอักษร').max(20, 'ชื่อผู้เล่นต้องมี 2-20 ตัวอักษร'),
    email: z.string().email('กรุณากรอกอีเมลให้ถูกต้อง'),
    password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'รหัสผ่านไม่ตรงกัน',
    path: ["confirm"],
  });

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirm: "" },
  });

  async function onSubmit(data: RegisterValues) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      await registerUser({
        name: data.name,
        email: data.email,
        password: data.password,
      });
      toast('สมัครสมาชิกสำเร็จ');
      router.replace("/dashboard");
    } catch (error) {
      const code = error instanceof AuthError ? error.code : null;
      if (code === "EMAIL_TAKEN") {
        form.setError("email", { message: 'อีเมลนี้ถูกใช้แล้ว' });
      } else if (code === "INVALID_CREDENTIALS") {
        setFormError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      } else {
        setFormError(GENERIC_ERROR);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ชื่อผู้เล่น</FormLabel>
              <FormControl>
                <Input autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>อีเมล</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>รหัสผ่าน</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ยืนยันรหัสผ่าน</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 aria-hidden="true" className="animate-spin" />
              {'กำลังสมัครสมาชิก…'}
            </>
          ) : 'สมัครสมาชิก'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          มีบัญชีอยู่แล้ว?{" "}
          <Link href="/login" className="text-primary hover:underline">
            เข้าสู่ระบบ
          </Link>
        </p>
      </form>
    </Form>
  );
}
