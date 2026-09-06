// Temporary stand-in movie provider, used only until the omdb-proxy Edge
// Function is deployed and VITE_OMDB_PROXY_ENABLED is set (see
// providers/index.ts). Implements the same MediaProvider
// contract as the real OMDb provider so swapping is a one-line change.
// Ratings are intentionally left blank — these are placeholder facts, not
// real external scores.

import type { FullDetails, MediaProvider, SearchResultItem } from "./types";
import { ProviderRequestError } from "./types";
import { searchWithTypoFallback } from "./searchHelpers";

interface MockMovie {
  id: string;
  title: string;
  year: number;
  genres: string[];
  overview: string;
}

const MOCK_MOVIES: MockMovie[] = [
  { id: "mock-1", title: "Inception", year: 2010, genres: ["Sci-Fi", "Thriller"], overview: "A thief who enters people's dreams to steal secrets is offered a chance to erase his past by planting an idea instead." },
  { id: "mock-2", title: "The Matrix", year: 1999, genres: ["Sci-Fi", "Action"], overview: "A hacker discovers that the world he knows is a simulation and joins a rebellion against its machine creators." },
  { id: "mock-3", title: "Titanic", year: 1997, genres: ["Romance", "Drama"], overview: "Two passengers from different social classes fall in love aboard a doomed ocean liner." },
  { id: "mock-4", title: "The Godfather", year: 1972, genres: ["Crime", "Drama"], overview: "The patriarch of a powerful crime family transfers control to his reluctant son." },
  { id: "mock-5", title: "Parasite", year: 2019, genres: ["Drama", "Thriller"], overview: "A poor family schemes their way into the lives of a wealthy household, with unexpected consequences." },
  { id: "mock-6", title: "Interstellar", year: 2014, genres: ["Sci-Fi", "Drama"], overview: "A team of explorers travels through a wormhole in search of a new home for humanity." },
  { id: "mock-7", title: "The Dark Knight", year: 2008, genres: ["Action", "Crime"], overview: "A vigilante confronts a chaotic criminal mastermind who wants to plunge his city into anarchy." },
  { id: "mock-8", title: "Pulp Fiction", year: 1994, genres: ["Crime", "Drama"], overview: "The lives of two hitmen, a boxer, and a gangster's wife intertwine across several violent tales." },
  { id: "mock-9", title: "Forrest Gump", year: 1994, genres: ["Drama", "Romance"], overview: "A kind-hearted man with a low IQ recounts the decades of extraordinary events he lived through." },
  { id: "mock-10", title: "The Shawshank Redemption", year: 1994, genres: ["Drama"], overview: "A banker wrongly imprisoned for murder forms an unlikely friendship and holds onto hope for decades." },
  { id: "mock-11", title: "Get Out", year: 2017, genres: ["Horror", "Thriller"], overview: "A young man uncovers a disturbing secret when he visits his girlfriend's family estate." },
  { id: "mock-12", title: "La La Land", year: 2016, genres: ["Musical", "Romance"], overview: "An aspiring actress and a jazz musician pursue their dreams while falling in love in Los Angeles." },
  { id: "mock-13", title: "Mad Max: Fury Road", year: 2015, genres: ["Action", "Adventure"], overview: "In a post-apocalyptic wasteland, a drifter joins a rebel fleeing a tyrant with his army." },
  { id: "mock-14", title: "The Grand Budapest Hotel", year: 2014, genres: ["Comedy", "Adventure"], overview: "A legendary concierge and his protégé become entangled in a theft and murder mystery at a famous hotel." },
  { id: "mock-15", title: "Whiplash", year: 2014, genres: ["Drama", "Music"], overview: "A young drummer enrolls at a cutthroat music conservatory under a ruthless instructor." },
  { id: "mock-16", title: "Coco", year: 2017, genres: ["Animation", "Family"], overview: "A boy is transported to the Land of the Dead and uncovers the truth about his family's history." },
  { id: "mock-17", title: "Spirited Away", year: 2001, genres: ["Animation", "Fantasy"], overview: "A young girl becomes trapped in a spirit world and must work to free herself and her parents." },
  { id: "mock-18", title: "Everything Everywhere All at Once", year: 2022, genres: ["Sci-Fi", "Comedy"], overview: "An overwhelmed laundromat owner discovers she must connect with parallel versions of herself to save reality." },
  { id: "mock-19", title: "Oppenheimer", year: 2023, genres: ["Drama", "History"], overview: "A physicist grapples with his role in developing the atomic bomb during and after World War II." },
  { id: "mock-20", title: "Barbie", year: 2023, genres: ["Comedy", "Fantasy"], overview: "A doll living in an idealized world sets out on a journey of self-discovery in the real world." },
  { id: "mock-21", title: "Dune", year: 2021, genres: ["Sci-Fi", "Adventure"], overview: "A young heir must navigate political intrigue on a dangerous desert planet central to the galaxy's future." },
  { id: "mock-22", title: "Knives Out", year: 2019, genres: ["Mystery", "Comedy"], overview: "A detective investigates the suspicious death of a wealthy crime novelist surrounded by his scheming family." },
  { id: "mock-23", title: "The Social Network", year: 2010, genres: ["Drama", "Biography"], overview: "The founding of a social media empire is shadowed by lawsuits and fractured friendships." },
  { id: "mock-24", title: "Amélie", year: 2001, genres: ["Comedy", "Romance"], overview: "A shy waitress in Paris secretly orchestrates small acts of kindness to improve the lives of those around her." },
  { id: "mock-25", title: "City of God", year: 2002, genres: ["Crime", "Drama"], overview: "Two boys growing up in a violent Rio de Janeiro neighborhood take very different paths in life." },
];

function literalSearch(query: string): Promise<SearchResultItem[]> {
  const q = query.toLowerCase();
  if (!q) return Promise.resolve([]);
  return Promise.resolve(
    MOCK_MOVIES.filter((m) => m.title.toLowerCase().includes(q)).map((m) => ({
      externalId: m.id,
      source: "mock-movie" as const,
      mediaType: "movie" as const,
      tvSubtype: null,
      title: m.title,
      year: m.year,
      posterUrl: null,
      overview: m.overview,
      isMockData: true,
    })),
  );
}

function search(query: string): Promise<SearchResultItem[]> {
  if (!query.trim()) return Promise.resolve([]);
  return searchWithTypoFallback(query, literalSearch);
}

async function getDetails(externalId: string): Promise<FullDetails> {
  const movie = MOCK_MOVIES.find((m) => m.id === externalId);
  if (!movie) {
    throw new ProviderRequestError("That title couldn't be found.");
  }
  return {
    externalId: movie.id,
    source: "mock-movie",
    mediaType: "movie",
    tvSubtype: null,
    title: movie.title,
    releaseYear: movie.year,
    releaseDate: null,
    posterUrl: null,
    overview: movie.overview,
    externalRating: null,
    externalRatings: [],
    genres: movie.genres,
    numberOfSeasons: null,
    isMockData: true,
  };
}

export const mockMovieProvider: MediaProvider = {
  id: "mock-movie",
  search,
  getDetails,
};
