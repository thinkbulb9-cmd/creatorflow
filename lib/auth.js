import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key);
};

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

        try {
          const supabase = getSupabase();

          const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', credentials.email)
            .single();

          if (error || !user) {
            console.error('User not found:', error?.message);
            return null;
          }

          const isValid = await bcrypt.compare(credentials.password, user.password);
          if (!isValid) {
            console.error('Invalid password for:', credentials.email);
            return null;
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          };
        } catch (err) {
          console.error('Auth error:', err);
          return null;
        }
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
        const supabase = getSupabase();

        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('email', token.email)
          .single();

        if (!existing) {
          const { data: newUser } = await supabase
            .from('users')
            .insert({
              name: token.name,
              email: token.email,
              image: token.picture,
              provider: account.provider,
            })
            .select('id')
            .single();

          token.id = newUser?.id;
        } else {
          token.id = existing.id;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) session.user.id = token.id;
      return session;
    },
  },

  pages: { signIn: '/auth' },
  secret: process.env.NEXTAUTH_SECRET,
};
