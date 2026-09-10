import { HttpInterceptorFn } from '@angular/common/http';

export const TOKEN_KEY = 'truckgps_token';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return next(req);
  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    })
  );
};
