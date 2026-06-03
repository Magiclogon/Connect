import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  get<T>(path: string) {
    return this.http.get<T>(`${environment.apiUrl}${path}`);
  }

  post<T>(path: string, body: unknown) {
    return this.http.post<T>(`${environment.apiUrl}${path}`, body);
  }

  put<T>(path: string, body: unknown) {
    return this.http.put<T>(`${environment.apiUrl}${path}`, body);
  }

  delete<T>(path: string) {
    return this.http.delete<T>(`${environment.apiUrl}${path}`);
  }

  upload(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ mediaId: string; contentType: string; size: number }>(
      `${environment.apiUrl}/upload`,
      form,
    );
  }

  /** User-facing message from upload HTTP errors (413, 400, 500). */
  uploadErrorMessage(err: unknown): string {
    const body = (err as { error?: { message?: string | string[] } })?.error;
    const msg = body?.message;
    if (Array.isArray(msg)) return msg[0] || 'Échec du téléversement';
    if (typeof msg === 'string') return msg;
    return 'Échec du téléversement. Vérifiez la taille (max 1 Go) et le format (MP4, WebM, MOV).';
  }

  /** Builds the URL to stream binary media stored in MongoDB (GET /media/:id). */
  mediaUrl(mediaId: string | null | undefined): string {
    if (!mediaId) return '';
    if (mediaId.startsWith('http')) return mediaId;
    if (mediaId.startsWith('/media/')) {
      return `${environment.apiUrl}${mediaId}`;
    }
    return `${environment.apiUrl}/media/${mediaId}`;
  }
}
