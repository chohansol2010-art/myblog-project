export interface Post {
  id: string;
  title: string;
  content: string;
  author_id: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      posts: {
        Row: Post;
        Insert: Omit<Post, 'id' | 'created_at'>;
        Update: Partial<Omit<Post, 'id' | 'created_at'>>;
      };
    };
  };
}
