import { EditProfileForm } from '@/components/EditProfileForm';
import { LoginArea } from '@/components/auth/LoginArea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';
import { Link, useNavigate } from 'react-router-dom';

export default function Settings() {
  const { currentUser, removeLogin } = useLoggedInAccounts();
  const navigate = useNavigate();

  if (!currentUser) {
    return (
      <div className='flex min-h-screen flex-col bg-gradient-to-b from-blue-50 to-white'>
        <header className='border-b'>
          <div className='container mx-auto flex items-center justify-between p-4'>
            <Link
              to='/groups'
              className='flex flex-row items-baseline gap-0 font-bold text-4xl transition-opacity hover:opacity-80'
            >
              <span className='font-black text-5xl text-red-500'>+</span>
              Chorus
            </Link>
            <div className='account-switcher-small'>
              <LoginArea />
            </div>
          </div>
        </header>
        <main className='flex flex-1 items-center justify-center'>
          <Card className='w-full max-w-md'>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-center text-muted-foreground'>
                You must be logged in to view your settings.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const handleLogout = () => {
    localStorage.removeItem('hasOnboarded');
    removeLogin(currentUser.id);
    navigate('/');
  };

  return (
    <div className='flex min-h-screen flex-col bg-gradient-to-b from-blue-50 to-white'>
      <header className='border-b'>
        <div className='container mx-auto flex items-center justify-between p-4'>
          <Link
            to='/groups'
            className='flex flex-row items-baseline gap-0 font-bold text-4xl transition-opacity hover:opacity-80'
          >
            <span className='font-black text-5xl text-red-500'>+</span>
            Chorus
          </Link>
          <div className='account-switcher-small'>
            <LoginArea />
          </div>
        </div>
      </header>
      <main className='flex flex-1 items-center justify-center'>
        <Card className='w-full max-w-md'>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className='space-y-8'>
            <section>
              <h2 className='mb-2 font-semibold text-lg'>Update Profile</h2>
              <EditProfileForm />
            </section>
            <Separator />
            <section>
              <h2 className='mb-2 font-semibold text-lg'>Log out</h2>
              <Button variant='destructive' className='w-full' onClick={handleLogout}>
                Log out
              </Button>
            </section>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
