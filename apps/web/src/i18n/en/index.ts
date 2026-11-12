import { common } from './common';
import { nav } from './nav';
import { format } from './format';
import { errors } from './errors';
import { validation } from './validation';
import { auth } from './auth';
import { home } from './home';
import { book } from './book';
import { quiz } from './quiz';
import { results } from './results';
import { profile } from './profile';
import { registration } from './registration';
import { prizes } from './prizes';
import { verify } from './verify';
import { notifications } from './notifications';
import { admin } from './admin';
import { adminQuest } from './adminQuest';
import { adminQuiz } from './adminQuiz';

/** The source of truth: every other language is typed against this shape. */
export const en = {
  common,
  nav,
  format,
  errors,
  validation,
  auth,
  home,
  book,
  quiz,
  results,
  profile,
  registration,
  prizes,
  verify,
  notifications,
  admin,
  adminQuest,
  adminQuiz
};

export type Messages = typeof en;
