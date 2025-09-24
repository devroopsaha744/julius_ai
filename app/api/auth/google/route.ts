import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/utils/mongoConnection';
import User from '../../../../lib/models/User';

type TokenInfo = {
  iss: string;
  azp?: string;
  aud?: string;
  sub: string; // google id
  email: string;
  email_verified?: string;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  iat?: string;
  exp?: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const idToken = body.id_token;
    if (!idToken) {
      return NextResponse.json({ error: 'id_token required' }, { status: 400 });
    }

    // Verify token with Google
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!verifyRes.ok) {
      const txt = await verifyRes.text();
      return NextResponse.json({ error: 'Invalid token', details: txt }, { status: 401 });
    }

    const info = (await verifyRes.json()) as TokenInfo;

    // Basic validation: ensure aud matches configured client id if provided
    const expectedClientId = process.env.GOOGLE_CLIENT_ID;
    if (expectedClientId && info.aud && info.aud !== expectedClientId) {
      return NextResponse.json({ error: 'Token audience mismatch' }, { status: 401 });
    }

    await dbConnect();

    // Upsert user by googleId (sub)
    const filter = { googleId: info.sub };
    const update = {
      googleId: info.sub,
      email: info.email,
      name: info.name || info.email,
      picture: info.picture,
    };
    const options = { upsert: true, new: true, setDefaultsOnInsert: true };

    const user = await User.findOneAndUpdate(filter, update, options).lean();

    return NextResponse.json({ ok: true, user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Google auth error', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
