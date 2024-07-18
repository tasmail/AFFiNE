import { Button } from '@affine/admin/components/ui/button';
import type { CarouselApi } from '@affine/admin/components/ui/carousel';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@affine/admin/components/ui/carousel';
import { useCallback, useEffect, useState } from 'react';

export const Form = () => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) {
      return;
    }

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on('select', () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api]);

  const onNext = useCallback(() => {
    api?.scrollNext();
  }, [api]);

  const onPrevious = useCallback(() => {
    api?.scrollPrev();
  }, [api]);

  return (
    <div className="flex flex-col justify-between h-full w-full  lg:pl-36 max-lg:items-center ">
      <Carousel setApi={setApi} className=" h-full w-full ">
        <CarouselContent>
          <CarouselItem
            key={0}
            className="flex flex-col h-full w-full mt-60 max-lg:items-center max-lg:mt-16"
            style={{ minHeight: '300px' }}
          >
            <h1 className="text-5xl font-extrabold  max-lg:text-3xl max-lg:font-bold">
              Welcome to AFFiNE{' '}
            </h1>
            <p className="mt-5 font-semibold text-xl max-lg:px-4 max-lg:text-lg ">
              Configure your Self Host AFFiNE with a few simple settings.
            </p>
          </CarouselItem>
          <CarouselItem key={1}>create Administrator AccountE</CarouselItem>
        </CarouselContent>
      </Carousel>
      <div>
        {current > 1 && (
          <Button className="mr-3" onClick={onPrevious}>
            Back
          </Button>
        )}
        <Button onClick={onNext}>Continue</Button>
      </div>

      <div className="py-2 px-0 text-sm mt-16 max-lg:mt-5 relative">
        {Array.from({ length: count }).map((_, index) => (
          <span
            key={index}
            className={`inline-block w-16 h-1 rounded mr-1 ${
              index === current - 1
                ? 'bg-primary'
                : 'bg-muted-foreground opacity-20'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
