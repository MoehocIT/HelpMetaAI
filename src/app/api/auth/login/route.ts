import { scryptSync, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import connectDB from '../../../../lib/mongodb';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '../../../../lib/auth';
import User from '../../../../models/User';

function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, salt, hash, extra] = encodedHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !hash || extra || !/^[a-f\d]+$/i.test(hash)) {
    return false;
  }

  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== 64) return false;
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(expected, actual);
}

export async function POST(request: Request) {
  if (!process.env.AUTH_SECRET) {
    return NextResponse.json(
      { error: 'Máy chủ chưa cấu hình AUTH_SECRET.' },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu đăng nhập không hợp lệ.' }, { status: 400 });
  }

  const payload = body as { email?: unknown; password?: unknown };
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  if (!email || email.length > 254 || !password || password.length > 1024) {
    return NextResponse.json({ error: 'Hãy nhập email và mật khẩu hợp lệ.' }, { status: 400 });
  }

  try {
    await connectDB();
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Email hoặc mật khẩu không đúng.' }, { status: 401 });
    }

    const sessionUser = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    } as const;
    const response = NextResponse.json({ success: true, user: sessionUser });
    response.cookies.set(SESSION_COOKIE, createSessionToken(sessionUser), sessionCookieOptions());
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Không thể đăng nhập lúc này. Hãy kiểm tra cấu hình database và AUTH_SECRET.' },
      { status: 503 }
    );
  }
}
