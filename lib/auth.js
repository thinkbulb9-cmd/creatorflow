import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { getDb } from './mongodb';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const db = await getDb();
        const user = await db.collection('users').findOne({ email: credentials.email });
        if (!user) return null;
        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;
        return { id: user._id, name: user.name, email: user.email, image: user.image };
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || 'placeholder',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder',
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || 'placeholder',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || 'placeholder',
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) token.id = user.id;
      if (account && (account.provider === 'google' || account.provider === 'github')) {
        const db = await getDb();
        let existing = await db.collection('users').findOne({ email: token.email });
        if (!existing) {
          const userId = uuidv4();
          await db.collection('users').insertOne({
            _id: userId, name: token.name, email: token.email,
            image: token.picture, provider: account.provider, created_at: new Date()
          });
          token.id = userId;
        } else {
          token.id = existing._id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.id;
      return session;
    },
  },
  pages: { signIn: '/' },
  secret: process.env.NEXTAUTH_SECRET || 'fallback-secret',
};
