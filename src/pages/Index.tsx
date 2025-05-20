import { EditProfileForm } from '@/components/EditProfileForm';
import LoginDialog from '@/components/auth/LoginDialog';
import SignupDialog from '@/components/auth/SignupDialog';
import { Button } from '@/components/ui/button';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { toast } from '@/hooks/useToast';
import { randomTwoWordName } from '@/lib/utils';
import { useCallback, useEffect, useState } from 'react';

const ONBOARDED_KEY = 'hasOnboarded';

const Index = () => {
  const { currentUser } = useLoggedInAccounts();
  const [step, setStep] = useState<'start' | 'signup' | 'login' | 'profile' | 'done'>('start');
  const [randomName, setRandomName] = useState<string>('');
  const { mutateAsync: publishEvent, isPending: isPublishing } = useNostrPublish();
  const [profileSaved, setProfileSaved] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [initialProfileSaved, setInitialProfileSaved] = useState(false);
  // Track how the user arrived: 'none' | 'signup' | 'login'
  const [signupMethod, setSignupMethod] = useState<'none' | 'signup' | 'login'>('none');

  // Helper: check if currentUser has a name (existing profile)
  const hasProfile = !!currentUser?.metadata?.name;

  // On login/signup, handle onboarding logic
  useEffect(() => {
    if (!currentUser) return;

    // Only run onboarding logic if not already onboarded
    if (!hasOnboarded) {
      if (signupMethod === 'signup' && !initialProfileSaved) {
        // New user: generate fake name and save kind:0 event
        const generatedName = randomTwoWordName();
        setRandomName(generatedName);
        setStep('profile');
        setInitialProfileSaved(true);
        (async () => {
          try {
            await publishEvent({
              kind: 0,
              content: JSON.stringify({ name: generatedName }),
            });
            // Optionally: invalidate queries here if needed
          } catch (e) {
            toast({
              title: 'Error',
              description: 'Failed to save initial profile',
              variant: 'destructive',
            });
            setInitialProfileSaved(false); // allow retry on error
          }
        })();
      } else if (signupMethod === 'login') {
        // Existing user: mark as onboarded, skip onboarding
        setHasOnboarded(true);
        try {
          localStorage.setItem(ONBOARDED_KEY, 'true');
        } catch {}
        setStep('done');
      }
    }
  }, [currentUser, hasOnboarded, signupMethod, initialProfileSaved, publishEvent]);

  // Handler for finishing onboarding (after profile save or skip)
  const handleFinish = useCallback(() => {
    setStep('done');
    setProfileSaved(true);
    setHasOnboarded(true);
    try {
      localStorage.setItem(ONBOARDED_KEY, 'true');
    } catch {}
  }, []);

  // Handler for skipping profile setup (should not double-save kind:0)
  const handleSkip = useCallback(async () => {
    handleFinish();
  }, [handleFinish]);

  // Handler for when EditProfileForm is submitted
  const handleProfileSaved = useCallback(() => {
    toast({
      title: 'Profile updated',
      description: 'Your profile has been saved.',
    });
    handleFinish();
  }, [handleFinish]);

  // UI rendering logic
  return (
    <div className='flex min-h-screen flex-col bg-gradient-to-b from-blue-50 to-white'>
      {/* Header */}
      <header className='border-b'>
        <div className='container mx-auto flex items-center justify-between p-4'>
          <h1 className='flex flex-row items-baseline gap-0 font-bold text-4xl'>
            <span className='font-black text-5xl text-red-500'>+</span>
            Chorus
          </h1>
        </div>
      </header>

      <main className='flex flex-1 items-center justify-center'>
        <div className='container mx-auto w-full max-w-md px-4 py-16'>
          {!hasOnboarded && step === 'start' && (
            <div className='space-y-6 rounded-2xl bg-white p-8 text-center shadow-lg'>
              <h2 className='mb-2 font-bold text-3xl'>Welcome to Chorus</h2>
              <p className='mb-6 text-gray-600'>
                Join decentralized communities on Nostr. To get started, create a new account or
                sign in with your existing Nostr key.
              </p>
              <Button
                className='w-full py-6 text-lg'
                onClick={() => {
                  setStep('signup');
                  setSignupMethod('signup');
                }}
              >
                Create a new account
              </Button>
              <div className='mt-4 text-gray-500 text-sm'>
                Already have an account?{' '}
                <button
                  type='button'
                  className='font-medium text-blue-600 hover:underline'
                  onClick={() => {
                    setStep('login');
                    setSignupMethod('login');
                  }}
                >
                  Sign in with existing Nostr account
                </button>
              </div>
            </div>
          )}

          {!hasOnboarded && step === 'signup' && (
            <SignupDialog
              isOpen={true}
              onClose={() => {
                setStep('start');
                setSignupMethod('none');
              }}
            />
          )}

          {!hasOnboarded && step === 'login' && (
            <LoginDialog
              isOpen={true}
              onClose={() => {
                setStep('start');
                setSignupMethod('none');
              }}
              onLogin={() => setStep('profile')}
            />
          )}

          {!hasOnboarded &&
            step === 'profile' &&
            currentUser &&
            !profileSaved &&
            signupMethod === 'signup' && (
              <div className='rounded-2xl bg-white p-8 shadow-lg'>
                <h2 className='mb-4 text-center font-bold text-2xl'>Set up your profile</h2>
                <p className='mb-6 text-center text-gray-600'>
                  This is how you'll appear to others. You can change it later.
                </p>
                <EditProfileForm
                  key={currentUser.pubkey}
                  initialName={randomName}
                  onSaved={handleProfileSaved}
                />
                <Button
                  variant='outline'
                  className='mt-4 w-full'
                  onClick={handleSkip}
                  disabled={isPublishing}
                >
                  Skip for now
                </Button>
              </div>
            )}

          {step === 'done' && (
            <div className='space-y-6 rounded-2xl bg-white p-8 text-center shadow-lg'>
              <h2 className='font-bold text-2xl'>You're all set!</h2>
              <p className='text-gray-600'>
                Your account is ready. You can now join communities and start connecting.
              </p>
              <Button className='w-full py-6 text-lg' asChild>
                <a href='/groups'>Continue to Communities</a>
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className='mt-auto bg-gray-100 py-8'>
        <div className='container mx-auto px-4 text-center text-gray-600'>
          <p>Built with Nostr NIP-72 • Decentralized Communities</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
