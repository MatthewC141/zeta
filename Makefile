CXX ?= c++
CXXFLAGS ?= -std=c++17 -O2 -Wall -Wextra

zeta: zeta.cpp
	$(CXX) $(CXXFLAGS) -o $@ $<

play: zeta
	./zeta

tracker: zeta
	./zeta tracker

clean:
	rm -f zeta

.PHONY: play tracker clean
