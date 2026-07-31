import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import { firstValueFrom } from "rxjs";
import { Category, CategoryRequest } from "../models/category";

@Injectable({ providedIn: 'root' })
export class CategoryService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiUrl}/categories`;

    async getAll(): Promise<Category[]> {
        return firstValueFrom(this.http.get<Category[]>(this.apiUrl));
    }

    async create(request: CategoryRequest): Promise<Category> {
        return firstValueFrom(this.http.post<Category>(this.apiUrl, request));
    }

    async update(id: number, request: CategoryRequest): Promise<Category> {
        return firstValueFrom(this.http.put<Category>(`${this.apiUrl}/${id}`, request));
    }

    async delete(id: number): Promise<void> {
        await firstValueFrom(this.http.delete<void>(`${this.apiUrl}/${id}`));
    }
}
